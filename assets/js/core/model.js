// ── ECONOMIC MODEL (v2 — with 7 structural improvements) ────────
//
// Improvements implemented:
//  [1] Debt service feedback loop (deficit → yields → interest cost → wider deficit)
//  [2] Nonlinearities at extremes (FFR overshoot, HY crisis, CPI spiral, deficit vigilante)
//  [3] Cross-variable amplifiers (credit seizure hits CAPEX + hiring)
//  [4] Wealth effects feedback (S&P + housing → consumption → GDP, two-pass)
//  [5] Recession regime-switching (GDP<0 triggers amplified unemployment, confidence collapse)
//  [6] TFP compounding in projection chart (handled in renderGdpChart)
//  [7] Labor market nonlinearity (unemp < 3.5% → convex wage-price pressure)
//  [8] Political economy asymmetric hysteresis (degradation >> improvement)
//  [9] Confidence as multiplier on CAPEX sensitivity (not just additive)
// v3 additions:
//  [A] Time horizon weights (1yr/3yr/10yr) — shifts which factors dominate
//  [B] Dollar → CPI passthrough lag (55%/82%/100% by horizon)
//  [C] Monetary policy lag — FFR effect attenuates at longer horizons

// [8] Asymmetric pol-econ GDP impact: degradation hits harder than improvement
function polEconGdpImpact(s) {
  // asymCoeff: below-neutral slope > above-neutral slope
  function asym(val, neutral, upC, dnC) {
    const d = val - neutral;
    return d >= 0 ? d * upC : d * dnC;
  }
  return (
    asym(s.policyCert,     4,  0.072, 0.110)   // degradation 53% more damaging
    + asym(s.ruleOfLaw,    7,  0.042, 0.075)   // rule of law very hard to rebuild
    + asym(s.cbIndependence,7, 0.048, 0.090)   // CB erosion triggers risk premium spike
    + asym(s.govEffective,  5, 0.030, 0.046)
    + asym(s.socialCapital, 5, 0.025, 0.038)
    + asym(s.electoralStab, 7, 0.020, 0.055)   // instability has outsized negative effect
    - (s.polarization - 5) * 0.022             // symmetric (both directions bad)
    - (s.regCapture   - 5) * 0.018
  );
}


function calendarShockPathFactor(shock) {
  if (!calendarShockSyncEnabled || currentCountry !== 'us') return 0;
  const released = parseCalendarDate(shock.releaseDate);
  if (Number.isNaN(released.getTime())) return 0;
  const ageMonths = Math.max(0, (Date.now() - released.getTime()) / (86400000 * 30.4375)) + shockProjectionMonth;
  const peak = Math.max(0, +shock.peakMonth || 0);
  const duration = Math.max(1, +shock.durationMonths || 4);
  if (ageMonths > duration) return 0;
  if (peak > 0 && ageMonths < peak) return Math.max(0.05, ageMonths / peak);
  return Math.exp(-Math.max(0.01, +shock.decayRate || .4) * Math.max(0, ageMonths - peak));
}

function resolveCalendarShocks() {
  const empty = {effects:{},inputEffects:{},outputEffects:{gdpA:0,cpiA:0,spA:0,twoyrA:0,tenyrA:0,mortgA:0,confA:0,recessionRiskA:0},contributions:[],activeShocks:[],grossImpact:0};
  if (!calendarShockSyncEnabled || currentCountry !== 'us' || !surpriseEngine || !Array.isArray(surpriseEngine.shocks)) return empty;
  const shocks = surpriseEngine.shocks.slice().sort((a,b)=>String(b.releaseDate||'').localeCompare(String(a.releaseDate||'')));
  const seriesRanks = new Map();
  const contributions = [];
  for (const shock of shocks) {
    const path = calendarShockPathFactor(shock);
    if (path <= .001) continue;
    const series = shock.seriesKey || shock.seriesId || 'unknown';
    const rank = seriesRanks.get(series) || 0;
    seriesRanks.set(series, rank + 1);
    const supersessionWeight = [1,.45,.20,.10][Math.min(rank,3)];
    for (const channel of shock.channels || []) {
      const effect = (+channel.effect || 0) * path * supersessionWeight;
      if (Math.abs(effect) < 1e-7) continue;
      contributions.push({shockId:shock.id,versionId:shock.versionId,seriesKey:series,label:shock.label||series,releaseDate:shock.releaseDate,target:channel.target,effect,path,supersessionWeight,surpriseZ:+shock.surpriseZ||0,actual:shock.actual,expected:shock.expected,revisionDetected:!!shock.revisionDetected});
    }
  }
  const effects = {};
  contributions.forEach(c => effects[c.target] = (effects[c.target] || 0) + c.effect);
  const outputEffects = {...empty.outputEffects};
  const inputEffects = {};
  Object.entries(effects).forEach(([target,effect]) => { if (target in outputEffects) outputEffects[target]=effect; else inputEffects[target]=effect; });
  const activeShocks = shocks.map(shock => {
    const parts=contributions.filter(c=>c.shockId===shock.id); const path=parts.length?Math.max(...parts.map(c=>c.path)):0;
    return {...shock,path,netEffects:Object.fromEntries(parts.map(c=>[c.target,c.effect]))};
  }).filter(s=>s.path>.001);
  return {effects,inputEffects,outputEffects,contributions,activeShocks,grossImpact:contributions.reduce((sum,c)=>sum+Math.abs(c.effect),0)};
}

function formatCalendarShockEffect(target,value) {
  if (['gdpA','cpiA','twoyrA','tenyrA','mortgA'].includes(target)) return formatSigned(value,2,'pp');
  if (target==='spA') return formatSigned(value,1,'%');
  if (target==='confA'||target==='recessionRiskA') return formatSigned(value,1,'pts');
  const sl=getSliderDef(target); return sl ? `${value>=0?'+':''}${sl.fmt(Math.abs(value))}` : formatSigned(value,2);
}

function compute() {
  // ── Resolve structured scenario shocks ───────────────────────────
  const s = {...vals};
  const shockState = resolveActiveShocks(s);
  const calendarShockState = resolveCalendarShocks();
  applyShockInputEffects(s, shockState.inputEffects);
  applyShockInputEffects(s, calendarShockState.inputEffects);
  const scenarioGdpA = shockState.outputEffects.gdpA || 0;
  const scenarioCpiA = shockState.outputEffects.cpiA || 0;
  const scenarioSpA  = shockState.outputEffects.spA  || 0;
  const calendarGdpA = calendarShockState.outputEffects.gdpA || 0;
  const calendarCpiA = calendarShockState.outputEffects.cpiA || 0;
  const calendarSpA  = calendarShockState.outputEffects.spA  || 0;
  const gdpA = scenarioGdpA + calendarGdpA;
  const cpiA = scenarioCpiA + calendarCpiA;
  const spA  = scenarioSpA + calendarSpA;

  // Horizon-weighted coefficients for all GDP categories
  const W = getHorizonWeights(timeHorizon);
  // Apply country-specific coefficient adjustments on top of horizon weights
  const _CC = getCountryAdjustments(currentCountry);
  Object.keys(_CC).forEach(k => { if (W[k] !== undefined) W[k] = +(W[k] * _CC[k]).toFixed(4); });
  const _CFG = COUNTRY_CONFIGS[currentCountry] || COUNTRY_CONFIGS.us;
  const _neutralFFR = _CFG.neutralFFR || 3.5;
  const _gdpBase    = _CFG.gdpBase    || 2.5;
  const _cpiBase    = _CFG.cpiBase    || 2.5;
  const _tenyrBase  = _CFG.tenyrBase  || 4.2;


  // ── [TAYLOR RULE] Endogenous Fed reaction function ───────────────
  // Bernanke-Taylor rule: FFR = r* + pi + 1.5*(pi-pi*) + 0.5*(y-y*)
  // where r*=2, pi*=2, y-y* approximated via (4-unemp)*1.8 (Okun)
  let taylorFFR = s.ffr;
  if (taylorRuleOn) {
    const cpi0 = _cpiBase + (s.oil-70)*0.016 + (s.tariff-10)*0.022
               + (s.deficit-4)*0.038 - (s.ffr-_neutralFFR)*0.18 + s.govSpend*0.025
               + (s.oilConflict-5)*0.025;
    taylorFFR = Math.max(0, Math.min(10, 2 + 1.5*(cpi0-2) + 0.5*(4-s.unemp)));
    s.ffr = taylorFFR;
    const ffrEl  = document.getElementById('r-ffr');
    const ffrVEl = document.getElementById('v-ffr');
    if (ffrEl)  ffrEl.value = taylorFFR;
    if (ffrVEl) ffrVEl.textContent = taylorFFR.toFixed(2) + '%';
  }

  // ── PASS 1: Preliminary CPI (needed to compute yields) ──────────
  let cpi = _cpiBase
    + (s.oil       - 70)   * 0.016
    + (s.natgas    - 3.5)  * 0.04
    + (s.tariff    - 10)   * 0.022
    + (s.deficit   - 4)    * 0.038
    - (s.ffr       - 3)    * 0.18
    +  s.govSpend          * 0.025
    - (s.innovRate  - 1.5) * 0.15
    + (s.shippingCost - 4) * 0.035
    - (s.renewableShare-22)* 0.006
    + (s.qePace > 0 ? s.qePace * 0.007 : 0)
    - (s.policyCert - 4)   * 0.015
    + (s.minWage   - 7.25) * 0.012
    + (s.unionMem  - 10)   * 0.018
    - (s.portEff   - 6)    * 0.015
    + (s.oilConflict - 5)  * 0.025
    - (s.dxy - 104)        * 0.010 * W.dxyLag  // [dollar lag] stronger USD → cheaper imports, lagged
    + cpiA;

  // [7] Labor market nonlinearity: below 3.5% unemp → convex wage-price spiral
  const unempGap = Math.max(0, 3.5 - s.unemp);
  const wagePriceSpiral = unempGap * unempGap * 0.10;
  cpi += wagePriceSpiral;

  // [2] CPI self-reinforcement above 6% (second-round effects, expectations unanchoring)
  if (cpi > 6) cpi += (cpi - 6) * 0.12;
  cpi += officialCalibrationBypass || !officialSyncEnabled ? 0 : (officialCalibration.cpi || 0);
  cpi = Math.max(0, Math.min(22, cpi));

  // ── [1] DEBT SERVICE FEEDBACK LOOP ─────────────────────────────
  // US debt ~$34T, GDP ~$28T → debt/GDP ≈ 122%
  // Weighted avg maturity ~6yr: effective avg rate = 65% locked at ~3.2% + 35% rolling
  const DEBT_TO_GDP = _CFG.debtToGDP || 1.22;
  const avgDebtRate = 0.35 * (4.2 + (s.ffr - 4.5) * 0.45 + Math.max(0, cpi - 2.5) * 0.28)
                    + 0.65 * 3.2; // approximate preliminary tenyr
  const interestCostPctGDP = DEBT_TO_GDP * avgDebtRate;
  // Baseline interest cost ~2.8% GDP; excess mechanically widens the deficit
  const debtServiceExcess = Math.max(0, interestCostPctGDP - 2.8);
  const effectiveDeficit  = s.deficit + debtServiceExcess;

  // [2] Bond vigilante premium: kicks in when effective deficit > 8% GDP
  const vigilantePremium = effectiveDeficit > 8 ? (effectiveDeficit - 8) * 0.09 : 0;

  // ── YIELDS (using effective deficit) ───────────────────────────
  let tenyr = _tenyrBase
    + (s.ffr         - 4.5) * 0.45
    + (effectiveDeficit - 6) * 0.055   // [1] effective deficit (includes interest cost)
    - (s.foreignDemand - 6) * 0.07
    - s.qePace              * 0.008
    + Math.max(0, cpi - 2.5)* 0.28
    + (s.termPremium  - 30) * 0.004
    + (s.tstIssuance  - 7)  * 0.04
    - s.ycc                 * 0.15
    - (s.cbIndependence - 7)* 0.04
    + vigilantePremium;                // [2] vigilante premium

  // [2] Nonlinearity: deficit > 10% triggers additional premium (Liz Truss moment)
  if (effectiveDeficit > 10) tenyr += (effectiveDeficit - 10) * 0.13;

  tenyr += officialCalibrationBypass || !officialSyncEnabled ? 0 : (officialCalibration.tenyr || 0);
  tenyr += calendarShockState.outputEffects.tenyrA || 0;
  tenyr = Math.max(0.5, Math.min(12, tenyr));

  let twoyr  = Math.max(0.2, s.ffr * 0.88 + 0.3
                  - (s.guidanceTone < 5 ? (5 - s.guidanceTone) * 0.12 : 0));
  twoyr += officialCalibrationBypass || !officialSyncEnabled ? 0 : (officialCalibration.twoyr || 0);
  twoyr += calendarShockState.outputEffects.twoyrA || 0;
  twoyr = Math.max(0.2, Math.min(12, twoyr));
  const fiveyr  = (twoyr + tenyr) / 2 + 0.1;
  const thirtyr = Math.min(12, tenyr + 0.3 + (s.termPremium - 30) * 0.002);
  const yldSprd = tenyr - twoyr;

  // [2] Inverted yield curve amplifies recession probability
  const inversionPenalty = yldSprd < -0.5 ? (Math.abs(yldSprd + 0.5)) * 0.18 : 0;

  // Mortgage: 10yr + 2.1% + credit stress
  let mortg = Math.max(3, Math.min(14,
    tenyr + 2.1
    + (s.igSpreads - 100) * 0.0025
    + (s.hySpreads > 700 ? (s.hySpreads - 700) / 1300 * 0.6 : 0)));
  mortg += officialCalibrationBypass || !officialSyncEnabled ? 0 : (officialCalibration.mortg || 0);
  mortg += calendarShockState.outputEffects.mortgA || 0;
  mortg = Math.max(3, Math.min(14, mortg)); // [2] nonlinear spread passthrough

  // ── [3] CROSS-VARIABLE AMPLIFIERS ─────────────────────────────
  // HY > 800bps: credit seizure propagates to CAPEX and hiring
  const hyStressRatio = s.hySpreads > 800 ? Math.min(1, (s.hySpreads - 800) / 1200) : 0;
  const creditSeizureGdp = -hyStressRatio * 1.4;   // up to -1.4% GDP
  const creditSeizureCpi = -hyStressRatio * 0.4;   // deflationary in crises

  // [2] FFR > 7%: convex tightening damage (credit channels seize)
  const ffrOvershoot  = Math.max(0, s.ffr - 7);
  const ffrConvexHit  = -(ffrOvershoot * ffrOvershoot) * 0.09;

  // [9] Confidence multiplier on CAPEX: uncertainty makes firms undershoot
  const confMultiplier = 0.65 + (s.policyCert / 10) * 0.70;
  const capexEffect    = (s.privateCapex - 17) * 0.058 * confMultiplier;

  // [CREDIT IMPULSE] Rate of change of private credit — best 2-quarter GDP lead
  // BIS research: 1pp credit impulse -> ~0.08% GDP within 2 quarters
  const creditImpulseEffect = (s.creditImpulse || 0) * 0.085;

  // [FISCAL MULTIPLIER REGIME] IMF (2013): multiplier 1.5+ at ZLB, 0.5-0.8 at normal rates
  // High debt + high rates = crowding out and confidence headwinds
  const fisMultScale = Math.max(0.22, Math.min(1.65,
    1.0
    - Math.max(0, s.ffr - 2.5)          * 0.110  // rising rates crowd out spending
    - Math.max(0, effectiveDeficit - 5)  * 0.030  // debt overhang
    + (s.ffr < 0.75 ? (0.75 - s.ffr) * 0.40 : 0) // ZLB bonus
  ));

  // ── PASS 2: GDP core ─────────────────────────────────────────────
  // Grouped contributions power the Overview waterfall while preserving
  // the original equation term-for-term.
  const gdpMonetary =
      -(s.ffr - _neutralFFR) * 0.28 * W.mon
      + ffrConvexHit * W.mon
      + (s.qePace > 0 ? s.qePace * 0.006 : s.qePace * 0.004) * W.mon
      - inversionPenalty * W.mon;
  const gdpFiscal =
      -(effectiveDeficit - 4) * 0.032
      - (s.corpTax - 21) * 0.022 * W.tax
      - (s.incomeTax - 37) * 0.005 * W.tax
      - (s.regBurden - 5) * 0.052 * W.tax
      + s.govSpend * 0.048 * W.fis * fisMultScale
      + (s.fedPermit - 4) * 0.032 * W.fis;
  const gdpInnovation =
      (s.innovRate - 1.5) * 0.42 * W.innov
      + (s.rdSpend - 3.1) * 0.12 * W.innov
      + (s.aiAdoption - 6) * 0.055 * W.innov
      + (s.vcFunding - 170) / 170 * 0.12 * W.innov
      + (s.stemGrowth - 2) * 0.025 * W.innov;
  const gdpTrade =
      -(s.tariff - 10) * 0.015 * W.trade
      + (s.fdiInflows - 6) * 0.035 * W.trade
      - (s.chinaDecoupling - 6) * 0.020 * W.trade
      + (s.nearshoring - 4) * 0.012 * W.trade;
  const gdpLabor =
      -(s.unemp - 4) * 0.15 * W.labor
      + (s.lfp - 62.5) * 0.05 * W.labor
      + (s.highSkillImmig - 5) * 0.040 * W.labor
      - (s.skillsGap - 6) * 0.025 * W.labor
      - (s.autoDisplace - 5) * 0.010 * W.labor;
  const gdpEnergy =
      -(s.oil - 70) * 0.005
      + (s.renewableShare - 22) * 0.003;
  const gdpCapex =
      capexEffect * W.capex
      + (s.infraSpend - 350) / 350 * 0.08 * W.capex
      + (s.permitSpeed - 4) * 0.032 * W.capex
      - (s.shippingCost - 4) * 0.022
      + (s.portEff - 6) * 0.015
      + (s.gridReliability - 6) * 0.012;
  const gdpState =
      -(s.stateCorpTax - 5) * 0.012
      - (s.stateRegEnv - 5) * 0.020
      + (s.stateFiscalHealth - 5) * 0.010;
  const gdpPoliticalEconomy = polEconGdpImpact(s) * W.polEcon;
  const gdpGeopolitics =
      -(s.conflictIndex - 5) * 0.040
      - (s.chinaMilRisk - 6) * 0.025
      - (s.cyberRisk - 6) * 0.010
      + (s.dollarReserve - 8) * 0.020
      + (s.allyRelations - 6) * 0.012;
  const gdpCredit = creditSeizureGdp + creditImpulseEffect;
  const gdpScenarioEvents = scenarioGdpA;
  const gdpCalendarReleases = calendarGdpA;
  const gdpOfficialCalibration = officialCalibrationBypass || !officialSyncEnabled ? 0 : (officialCalibration.gdp || 0);

  let gdp = _gdpBase
    + gdpMonetary
    + gdpFiscal
    + gdpInnovation
    + gdpTrade
    + gdpLabor
    + gdpEnergy
    + gdpCapex
    + gdpState
    + gdpPoliticalEconomy
    + gdpGeopolitics
    + gdpCredit
    + gdpScenarioEvents
    + gdpCalendarReleases
    + gdpOfficialCalibration;

  gdp = Math.max(-8, Math.min(10, gdp));

  // ── [5] RECESSION REGIME-SWITCHING ─────────────────────────────
  // When GDP < 0, animal spirits collapse and feedback loops amplify
  const inRecession = gdp < 0;
  let recessionAmplifier = 0;
  if (inRecession) {
    const depth = Math.abs(gdp);             // 0–8
    recessionAmplifier = depth * 0.12;       // deeper = worse feedback
    gdp  = Math.max(-8, gdp - recessionAmplifier);
    cpi += creditSeizureCpi;                 // deflationary credit crunch
  }

  // ── [INTERNATIONAL SPILLBACK] ─────────────────────────────────────
  // US growth drives global demand, which feeds back via export channel
  // US exports ~12% of GDP; estimated spillback multiplier: ~0.07
  const rowGrowth = 2.8
    + (gdp - 2.5)           * 0.28   // US growth spills to trading partners
    - (s.conflictIndex - 5) * 0.14   // geopolitical drag
    - (s.tariff - 10)       * 0.018  // protectionism reduces global activity
    + (s.allyRelations - 6) * 0.06;  // allied coordination dividend
  const rowSpillback = (rowGrowth - 2.8) * 0.07;
  gdp = Math.max(-8, Math.min(10, gdp + rowSpillback));

  // ── [4] WEALTH EFFECTS (two-pass) ──────────────────────────────
  // Compute preliminary S&P and housing to derive wealth effect on consumption
  const sp_pre = 100
    + (gdp  - 2.5)   * 12
    - Math.max(0, cpi - 2.5) * 4.5
    - (s.ffr - 3.5)  * 5.5
    - (s.corpTax-21) * 1.5
    + (s.innovRate-1.5)* 8
    + (s.aiAdoption-6) * 3.5
    - (s.igSpreads-100)* 0.06
    + (s.policyCert-4) * 2.0
    - (s.polarization-5)*1.5
    - (s.chinaMilRisk-6)*1.2
    + (s.dollarReserve-8)*1.0
    + spA;

  const haff_pre = 50
    - (mortg - 6.9)         * 5.5
    + (s.housingSupply-1.4) * 10
    - (s.zoning - 7)        * 2.5
    - (s.pti   - 7)         * 3.0
    + (s.localPermit - 4)   * 1.5
    - (s.propTax - 1.1)     * 2.0
    +  s.housingAct         * 1.8
    + (s.localPermitState-3)* 1.2
    - (s.vacancyRate < 4 ? (4 - s.vacancyRate) * 2 : 0)
    + (s.fedLandPermit - 4) * 0.8;

  // MPC on financial wealth ~3-4¢ per $1; housing wealth ~2-3¢ per $1
  // Map to GDP: S&P ±10pts → ±0.25% GDP; housing ±10 afford pts → ±0.15% GDP
  const spWealthEffect  = ((sp_pre   - 100) / 100) * 0.25;
  const hsWealthEffect  = ((haff_pre - 50)  / 50)  * 0.15;
  const wealthEffect = spWealthEffect * 0.5 + hsWealthEffect * 0.3;
  gdp = Math.max(-8, Math.min(10, gdp + wealthEffect));

  // ── TFP ─────────────────────────────────────────────────────────
  let tfp = 1.2
    + (s.rdSpend    - 3.1)  * 0.18
    + (s.innovRate  - 1.5)  * 0.50
    + (s.aiAdoption - 6)    * 0.12
    + (s.vcFunding-170)/170 * 0.10
    + (s.patentRate - 6)    * 0.05
    - (s.regBurden  - 5)    * 0.03
    + (s.highSkillImmig-5)  * 0.04
    + (s.infraSpend-350)/350* 0.05;
  tfp = Math.max(0, Math.min(5, tfp));

  // ── FINAL OUTPUTS ────────────────────────────────────────────────
  const housingAff = Math.max(3, Math.min(98, haff_pre));

  let sp500 = Math.max(10, Math.min(300, sp_pre));
  if (inRecession) sp500 = Math.max(10, sp500 * (1 + gdp * 0.04)); // recession amplifies drawdown

  let conf = 55
    + (gdp  - 2.5) * 6
    - (s.unemp - 4)* 4
    - (cpi  - 2.5) * 3
    - (mortg - 6.9)* 2
    + (s.policyCert - 4) * 2
    - (s.polarization-5) * 1.5;
  if (inRecession) conf -= Math.abs(gdp) * 6;  // [5] confidence collapses in recessions
  conf += calendarShockState.outputEffects.confA || 0;
  conf = Math.max(10, Math.min(100, conf));

  // [1] Effective deficit feeds into the displayed metric too
  const defAdj   = Math.max(-3, Math.min(25, effectiveDeficit - (gdp - 2.5) * 0.28 + s.govSpend * 0.05));
  const dollarAdj= Math.max(70, Math.min(145, s.dxy + (s.ffr - 4.5) * 3 - (effectiveDeficit - 6) * 0.5 + (tenyr - 4.2) * 2));

  // ── FINANCIAL STABILITY INDEX (100 = fully stable) ──────────────
  const fsi = Math.max(5, Math.min(100,
    100
    - hyStressRatio            * 42
    - (s.commercialREStress-5) * 4.0
    - Math.max(0, 10-s.stressTest) * 2.0
    - Math.max(0, s.igSpreads-150) * 0.040
    - (inRecession ? 18 : 0)
    - Math.max(0, s.hySpreads-600) * 0.012
    - (1 - s.cbIndependence/10)  * 6.0
    - vigilantePremium           * 8.0
  ));

  // Transparent deterministic risk score, not a statistically calibrated probability.
  const recessionRisk = Math.max(2, Math.min(98,
    18
    + Math.max(0, 1.8 - gdp) * 15
    + Math.max(0, s.unemp - 4.0) * 9
    + Math.max(0, -yldSprd) * 13
    + Math.max(0, s.hySpreads - 350) * 0.025
    + Math.max(0, 70 - fsi) * 0.45
    + Math.max(0, -s.creditImpulse) * 3.5
    + (calendarShockState.outputEffects.recessionRiskA || 0)
    + (inRecession ? 35 : 0)
  ));

  // ── SIX-SECTOR BREAKDOWN (0-100) ─────────────────────────────────
  const secHousing = clamp(50 - (mortg-6.9)*5.5 + (s.housingSupply-1.4)*12 - (s.pti-7)*4 + s.housingAct*2 - (s.zoning-7)*1.5);
  const secMfg     = clamp(50 - (s.tariff-10)*0.9 - (s.oil-70)*0.08 + (s.privateCapex-17)*2 - (s.dxy-104)*0.25 - (s.shippingCost-4)*1.8 + (s.nearshoring-4)*2 + (gdp-2.5)*4);
  const secServices= clamp(50 + (gdp-2.5)*8 - (s.unemp-4)*5 + (s.aiAdoption-6)*4 - (s.ffr-3.5)*2 + (s.policyCert-4)*2.5);
  const secFinance = clamp(50 + (fsi-50)*0.6 - (s.igSpreads-100)*0.05 + (s.dollarReserve-8)*3 - (s.regBurden-5)*2 + (gdp-2.5)*5);
  const secEnergy  = clamp(50 + (s.lngExport-6)*4 + (s.renewableShare-22)*0.8 - (s.oilConflict-5)*4 + (s.spr-55)*0.3 - (s.carbonPolicy-3)*2 + (gdp-2.5)*2);
  const secTech    = clamp(50 + (s.aiAdoption-6)*6 + (s.rdSpend-3.1)*8 + (s.vcFunding-170)/170*15 + (s.innovRate-1.5)*10 + (s.highSkillImmig-5)*3 - (s.capGainsTax-20)*0.5);

  return {
    gdp, cpi, tfp, tenyr, twoyr, fiveyr, thirtyr, mortg, yldSprd,
    housingAff, sp500, conf, defAdj, dollarAdj,
    unemp:+s.unemp.toFixed(1), recessionRisk:+recessionRisk.toFixed(1),
    // New diagnostic outputs
    inRecession,
    effectiveDeficit,
    interestCostPctGDP: +interestCostPctGDP.toFixed(2),
    debtServiceExcess:  +debtServiceExcess.toFixed(2),
    vigilantePremium:   +vigilantePremium.toFixed(2),
    wagePriceSpiral:    +wagePriceSpiral.toFixed(2),
    hyStressRatio:      +hyStressRatio.toFixed(2),
    fsi:                +fsi.toFixed(1),
    taylorFFR:          +taylorFFR.toFixed(2),
    fisMultScale:       +fisMultScale.toFixed(2),
    rowGrowth:          +rowGrowth.toFixed(2),
    rowSpillback:       +rowSpillback.toFixed(3),
    creditImpulseEffect:+creditImpulseEffect.toFixed(3),
    shockReport:shockState,
    calendarShockReport:calendarShockState,
    gdpContributions: {
      baseline:_gdpBase,
      Monetary:gdpMonetary,
      Fiscal:gdpFiscal,
      Innovation:gdpInnovation,
      Trade:gdpTrade,
      Labor:gdpLabor,
      Energy:gdpEnergy,
      'CAPEX & Infrastructure':gdpCapex,
      'State & Local':gdpState,
      'Political Economy':gdpPoliticalEconomy,
      Geopolitics:gdpGeopolitics,
      'Credit Conditions':gdpCredit,
      'Scenario Events':gdpScenarioEvents,
      'Economic Releases':gdpCalendarReleases,
      'Official Data Calibration':gdpOfficialCalibration,
      'Recession Feedback':-recessionAmplifier,
      'Global Spillback':rowSpillback,
      'Wealth Effects':wealthEffect
    },
    sectorOutputs: { Housing:secHousing, Manufacturing:secMfg, Services:secServices, Finance:secFinance, Energy:secEnergy, Technology:secTech },
    sectors: {
      Growth:    clamp(50 + (gdp - 2.5) * 15),
      Prices:    clamp(100 - Math.max(0, cpi - 1) * 14),
      Labor:     clamp(100 - (s.unemp - 2) * 9),
      Housing:   housingAff,
      Innovation:clamp(50 + (tfp - 1.2) * 30 + (s.aiAdoption - 6) * 3),
      Trade:     clamp(60 - (s.tariff - 10) * 0.8 + (s.fdiInflows - 6) * 4),
      Politics:  clamp(50 + (s.policyCert - 4) * 5 - (s.polarization - 5) * 3 + (s.ruleOfLaw - 7) * 4),
    }
  };
}

function clamp(v, lo=5, hi=98) { return Math.max(lo, Math.min(hi, v)); }

