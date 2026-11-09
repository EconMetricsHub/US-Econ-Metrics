

// ── DEFAULTS (also used for reset) ──────────────────────────────
const DEFAULTS = {
  ffr:4.5, qePace:-25, guidanceTone:6, stressTest:6, ioer:4.4, warshrules:5,
  deficit:6.5, corpTax:21, incomeTax:37, capGainsTax:20, govSpend:4.0, defenseSpend:3.5, regBurden:6, fedPermit:4,
  innovRate:1.5, rdSpend:3.1, aiAdoption:6, vcFunding:170, patentRate:6, stemGrowth:2.0, uniIndustry:5,
  foreignDemand:6, igSpreads:100, hySpreads:350, tstIssuance:7, ycc:0, termPremium:30, creditImpulse:0,
  tariff:10, dxy:104, tradeBalance:-3.5, chinaDecoupling:6, fdiInflows:6, nearshoring:4,
  housingSupply:1.4, zoning:7, fedLandPermit:4, pti:7.0, vacancyRate:6.0, commercialREStress:6, housingAct:0,
  unemp:4.1, lfp:62.5, minWage:7.25, unionMem:10, highSkillImmig:5, autoDisplace:5, skillsGap:6, noncompete:5,
  oil:72, natgas:3.5, electricCost:5, renewableShare:22, carbonPolicy:3, spr:55, lngExport:6, oilConflict:5,
  privateCapex:17.0, infraSpend:350, permitSpeed:4, localPermit:4, shippingCost:4, portEff:6, broadband:82, gridReliability:6,
  stateCorpTax:5.0, stateRegEnv:5, interstateMigration:6, stateFiscalHealth:5, localPermitState:3, propTax:1.1, rightToWork:50,
  policyCert:4, polarization:8, ruleOfLaw:7, govEffective:5, cbIndependence:7, socialCapital:5, regCapture:5, mediaQuality:5, electoralStab:7,
  conflictIndex:6, natoCommit:6, chinaMilRisk:6, energyGeopolitics:5, dollarReserve:8, cyberRisk:6, allyRelations:6
};
let vals = {...DEFAULTS};

// Phase B official-data state. Latest observations prefer the Worker Live Data
// Gateway (Cloudflare D1) and fall back to the generated static JSON. The browser
// never receives or requests the FRED API key.
let officialData = null;
let officialSyncEnabled = false;
let officialBaselineVals = null;
let officialAppliedAt = null;
let officialCalibrationBypass = false;
let officialCalibration = {gdp:0,cpi:0,tenyr:0,twoyr:0,mortg:0};
let sharedStateRestored = false;
let officialSyncRequestedFromShare = false;
let pendingSharedSliderOverrides = null;

// Phase C release-surprise state. Generated in GitHub Actions and consumed as
// a static ledger; no API credentials or private consensus feed reach visitors.
let surpriseEngine = null;
let calendarShockSyncEnabled = true;

// Active shock state is keyed by event id. Values are structured configs rather
// than booleans, but legacy true/false states remain backward compatible.
let activeEventIds = {};
let selectedShockId = null;
let shockProjectionMonth = 3;

// ── V6 PORTFOLIO + BRANCH + ANALYST STATE ───────────────────────
const PORTFOLIO_ASSETS = {
  SPY:{name:'S&P 500 ETF proxy',type:'equity',base:7.0,vol:18,beta:1.00},
  QQQ:{name:'Nasdaq-100 ETF proxy',type:'equity',base:8.0,vol:25,beta:1.25,sector:'Technology',sectorK:.24,rateK:-1.2},
  IWM:{name:'Russell 2000 ETF proxy',type:'equity',base:8.0,vol:28,beta:1.20,sector:'Manufacturing',sectorK:.16,rateK:-1.0},
  XLF:{name:'Financials ETF proxy',type:'equity',base:7.0,vol:22,beta:1.05,sector:'Finance',sectorK:.22,rateK:.45},
  XLE:{name:'Energy ETF proxy',type:'equity',base:7.0,vol:30,beta:.85,sector:'Energy',sectorK:.20,oilK:.16},
  XLI:{name:'Industrials ETF proxy',type:'equity',base:7.0,vol:21,beta:.95,sector:'Manufacturing',sectorK:.20},
  XLK:{name:'Technology ETF proxy',type:'equity',base:8.0,vol:25,beta:1.20,sector:'Technology',sectorK:.28,rateK:-1.1},
  XLU:{name:'Utilities ETF proxy',type:'equity',base:5.0,vol:16,beta:.55,rateK:-3.0},
  SOXX:{name:'Semiconductor ETF proxy',type:'equity',base:9.0,vol:34,beta:1.45,sector:'Technology',sectorK:.34,rateK:-1.2,shippingK:-.45},
  ITA:{name:'Aerospace & Defense ETF proxy',type:'equity',base:7.0,vol:20,beta:.78,defenseK:1.5},
  VNQ:{name:'REIT ETF proxy',type:'equity',base:6.0,vol:24,beta:.75,sector:'Housing',sectorK:.20,rateK:-4.0},
  TLT:{name:'Long Treasury ETF proxy',type:'bond',base:4.5,vol:15,duration:16.5},
  IEF:{name:'7–10yr Treasury ETF proxy',type:'bond',base:4.2,vol:8,duration:7.5},
  HYG:{name:'High-yield credit ETF proxy',type:'credit',base:6.5,vol:11,duration:3.8,spreadK:-.018,beta:.18},
  GLD:{name:'Gold ETF proxy',type:'gold',base:4.0,vol:16,inflK:2.2,dollarK:-.45,rateK:-2.2,riskK:.08},
  USO:{name:'Oil ETF proxy',type:'oil',base:0.0,vol:38,oilPctK:.82},
  CASH:{name:'Cash / T-bill proxy',type:'cash',base:0.0,vol:.5}
};
const DEFAULT_PORTFOLIO = [
  {symbol:'SPY',weight:40},{symbol:'QQQ',weight:15},{symbol:'IWM',weight:10},
  {symbol:'TLT',weight:15},{symbol:'GLD',weight:10},{symbol:'CASH',weight:10}
];
let portfolioValue = +(localStorage.getItem('macroscope.portfolio.value')||100000);
let portfolioHoldings = (()=>{try{const x=JSON.parse(localStorage.getItem('macroscope.portfolio.holdings')||'null');return Array.isArray(x)&&x.length?x:JSON.parse(JSON.stringify(DEFAULT_PORTFOLIO));}catch(e){return JSON.parse(JSON.stringify(DEFAULT_PORTFOLIO));}})();
let scenarioBranches = (()=>{try{const x=JSON.parse(localStorage.getItem('macroscope.branches')||'[]');return Array.isArray(x)?x:[];}catch(e){return [];}})();
let analystHistory = [];
let dataCopilotProposal = null;

// ── CATEGORIES ───────────────────────────────────────────────────
const CATEGORIES = [
  { id:'monetary', label:'Monetary Policy', icon:'⚡',
    desc:'Federal Reserve (Chair Kevin Warsh) monetary conditions, rate policy, and balance sheet dynamics.',
    sliders:[
      {id:'ffr',        label:'Fed Funds Rate',              min:0,   max:10,  step:0.25, fmt:v=>`${(+v).toFixed(2)}%`,   desc:'Primary FOMC policy lever. Warsh favors rules-based approach over discretion.'},
      {id:'qePace',     label:'Balance Sheet (QT ↔ QE)',    min:-150,max:150, step:5,    fmt:v=>`${v>0?'+':''}${v}B/mo`,  desc:'Neg = Quantitative Tightening. Pos = QE. Warsh strongly favors continued QT.'},
      {id:'guidanceTone',label:'Forward Guidance Tone',     min:1,   max:10,  step:1,    fmt:v=>['','Ultra-dovish','Dovish','Mildly dovish','Lean dovish','Neutral','Lean hawkish','Mildly hawkish','Hawkish','Very hawkish','Ultra-hawkish'][+v]||`${v}/10`,desc:'Signals future rate path. Shapes long-term yield expectations.'},
      {id:'stressTest', label:'Bank Stress-Test Stringency',min:1,   max:10,  step:1,    fmt:v=>`${v}/10`,                desc:'Higher = tighter capital requirements. Reduces credit supply, improves stability.'},
      {id:'ioer',       label:'Interest on Excess Reserves',min:0,   max:8,   step:0.25, fmt:v=>`${(+v).toFixed(2)}%`,   desc:'Rate paid on bank reserves at the Fed. Sets effective floor for overnight rates.'},
      {id:'warshrules', label:'Rules-Based Policy Adherence',min:1,  max:10,  step:1,    fmt:v=>`${v}/10`,                desc:'Adherence to Taylor Rule vs. discretion. Higher = more predictable, lower inflation risk premium.'},
    ]
  },
  { id:'fiscal', label:'Fiscal Policy', icon:'◆',
    desc:'Federal taxation, spending, regulation, and the budget deficit — the government\'s role in the economy.',
    sliders:[
      {id:'deficit',     label:'Federal Deficit (% of GDP)',   min:-2,  max:20,  step:0.5,  fmt:v=>`${(+v).toFixed(1)}%`,  desc:'Primary deficit as % of GDP. US currently ~6.5%. High deficits crowd out private investment and raise yields.'},
      {id:'corpTax',     label:'Corporate Tax Rate',           min:10,  max:40,  step:1,    fmt:v=>`${v}%`,                 desc:'Federal corporate income tax. Directly affects business investment and profit repatriation.'},
      {id:'incomeTax',   label:'Top Marginal Income Tax',      min:30,  max:70,  step:1,    fmt:v=>`${v}%`,                 desc:'Top federal rate. Affects high-earner behavior, capital formation, and talent retention.'},
      {id:'capGainsTax', label:'Capital Gains Tax Rate',       min:0,   max:45,  step:1,    fmt:v=>`${v}%`,                 desc:'Long-term capital gains rate. Key driver of investment realization and startup ecosystem health.'},
      {id:'govSpend',    label:'Gov\'t Spending Growth (% YoY)',min:-5, max:15,  step:0.5,  fmt:v=>`${(+v).toFixed(1)}%`,  desc:'Year-over-year federal outlay growth. Keynesian multiplier effects; inflationary at high rates.'},
      {id:'defenseSpend',label:'Defense Spending (% of GDP)', min:2,   max:8,   step:0.1,  fmt:v=>`${(+v).toFixed(1)}%`,  desc:'Military outlays. Technology spillovers (internet, GPS) but crowds out productive investment.'},
      {id:'regBurden',   label:'Federal Regulatory Burden',    min:1,   max:10,  step:1,    fmt:v=>`${v}/10`,               desc:'Cost of federal regulatory compliance. Every +1 costs ~0.05% GDP per year in model.'},
      {id:'fedPermit',   label:'Federal Permitting Speed',     min:1,   max:10,  step:1,    fmt:v=>`${v}/10`,               desc:'NEPA and agency permit timelines. Critical bottleneck for energy, mining, and infrastructure.'},
    ]
  },
  { id:'innovation', label:'Innovation & Productivity', icon:'◉',
    desc:'TFP growth, R&D investment, AI adoption, and the long-run productive potential of the economy.',
    sliders:[
      {id:'innovRate',   label:'Benchmark TFP Growth Rate',    min:0,   max:4,   step:0.1,  fmt:v=>`${(+v).toFixed(1)}%`,  desc:'Total Factor Productivity growth. Pre-AI trend: ~1.2%/yr. Key long-run GDP potential driver.'},
      {id:'rdSpend',     label:'R&D Spending (% of GDP)',      min:1,   max:6,   step:0.1,  fmt:v=>`${(+v).toFixed(1)}%`,  desc:'Public + private R&D investment. US currently ~3.1%. Each +1% boosts TFP by ~0.18%/yr.'},
      {id:'aiAdoption',  label:'AI/Automation Adoption Index', min:1,   max:10,  step:1,    fmt:v=>`${v}/10`,               desc:'Breadth of AI integration across industries. Major productivity unlock — potentially transformative.'},
      {id:'vcFunding',   label:'VC/Startup Funding ($B/yr)',   min:50,  max:600, step:10,   fmt:v=>`$${v}B`,                desc:'Annual venture capital deployment. Funds frontier innovation and new market creation.'},
      {id:'patentRate',  label:'Patent Filing Rate (index)',   min:1,   max:10,  step:1,    fmt:v=>`${v}/10`,               desc:'Innovation output proxy. Linked to university-industry tech transfer quality.'},
      {id:'stemGrowth',  label:'STEM Workforce Growth (% YoY)',min:0,   max:8,   step:0.5,  fmt:v=>`${(+v).toFixed(1)}%`,  desc:'Growth of science and engineering workforce. Critical constraint on innovation rate.'},
      {id:'uniIndustry', label:'University–Industry Linkage',  min:1,   max:10,  step:1,    fmt:v=>`${v}/10`,               desc:'Research commercialization depth. US leads globally but varies enormously by metro.'},
    ]
  },
  { id:'bonds', label:'Bond Markets', icon:'⟁',
    desc:'Treasury yield curve dynamics. Yields directly drive mortgage rates, housing affordability, and corporate borrowing.',
    warn:'Bond yields are the central transmission mechanism: 10yr UST → mortgage rates → housing prices → consumer wealth → GDP.',
    sliders:[
      {id:'foreignDemand',label:'Foreign UST Demand (index)', min:1,   max:10,  step:1,    fmt:v=>`${v}/10`,               desc:'Demand from foreign central banks (China, Japan). Anchors long yields. Any pullback raises rates substantially.'},
      {id:'igSpreads',   label:'IG Credit Spreads (bps)',     min:50,  max:600, step:10,   fmt:v=>`${v}bps`,               desc:'Investment-grade corporate spreads over Treasuries. Widens in recessions, tightens in booms.'},
      {id:'hySpreads',   label:'High-Yield Spreads (bps)',    min:200, max:2000,step:25,   fmt:v=>`${v}bps`,               desc:'Junk bond spreads. Best real-time recession barometer. >800bps historically precedes contractions.'},
      {id:'tstIssuance', label:'Treasury Issuance Pace',      min:1,   max:10,  step:1,    fmt:v=>`${v}/10`,               desc:'Volume of new Treasury supply hitting markets. High supply competes for demand, raises yields.'},
      {id:'ycc',         label:'Yield Curve Control Intensity',min:0,  max:10,  step:1,    fmt:v=>+v===0?'None (Off)':`${v}/10`,desc:'BoJ-style Fed cap on long yields. Suppresses 10yr, but at risk of inflation loss of control.'},
      {id:'termPremium', label:'Term Premium (bps)',          min:-100,max:300, step:10,   fmt:v=>`${v}bps`,               desc:'Extra yield demanded for duration risk. Negative in 2010s (safe haven flows). Rising with deficit.'},
      {id:'creditImpulse', label:'Credit Impulse (YoY Δ pp)',    min:-5,  max:5,   step:0.5,  fmt:v=>`${v>0?'+':''}${(+v).toFixed(1)}pp`, desc:'Change in YoY private credit growth — the most powerful short-run GDP leading indicator (Bridges et al., BIS). Positive = credit accelerating; negative = contracting.'},
    ]
  },
  { id:'trade', label:'Trade & FX', icon:'↔',
    desc:'Tariff policy, dollar strength, global trade balances, and supply chain configuration.',
    sliders:[
      {id:'tariff',         label:'Average Tariff Rate',          min:0,   max:60,  step:1,   fmt:v=>`${v}%`,                 desc:'Effective average tariff on all imports. Each +1% tariff → ~+0.02% CPI and -0.015% GDP.'},
      {id:'dxy',            label:'Dollar Strength (DXY)',        min:75,  max:135, step:1,   fmt:v=>`${v}`,                  desc:'USD index vs major currencies. Strong dollar = cheaper imports, but hurts exports and EM debt.'},
      {id:'tradeBalance',   label:'Trade Balance (% of GDP)',     min:-10, max:3,   step:0.5, fmt:v=>`${(+v).toFixed(1)}%`,  desc:'Current account. US structural deficit. Strong dollar widens it; tariffs have mixed effects.'},
      {id:'chinaDecoupling',label:'China Decoupling Intensity',   min:1,   max:10,  step:1,   fmt:v=>`${v}/10`,               desc:'Supply chain and tech bifurcation from China. Higher = more nearshoring costs short-term; more resilience long-term.'},
      {id:'fdiInflows',     label:'FDI Inflows Index',            min:1,   max:10,  step:1,   fmt:v=>`${v}/10`,               desc:'Foreign direct investment into US. Driven by policy certainty, profitability, and dollar stability.'},
      {id:'nearshoring',    label:'Nearshoring/Reshoring Progress',min:1,  max:10,  step:1,   fmt:v=>`${v}/10`,               desc:'Pace of supply chain return to US/Mexico/Canada. Short-term costs, long-term resilience dividend.'},
    ]
  },
  { id:'housing', label:'Housing & Real Estate', icon:'▦',
    desc:'Bonds → mortgages → affordability → prices. The most interest-rate-sensitive sector of the economy.',
    warn:'30yr mortgage ≈ 10yr Treasury + 2.1%. Every 100bps yield increase reduces housing affordability by ~7-10 points.',
    sliders:[
      {id:'housingSupply',   label:'New Housing Units/yr (M)',    min:0.5, max:3.0, step:0.1, fmt:v=>`${(+v).toFixed(1)}M`,  desc:'Annual residential construction. Structural US deficit ~400K/yr. Biggest long-run affordability lever.'},
      {id:'zoning',          label:'Zoning Restrictiveness',      min:1,   max:10,  step:1,   fmt:v=>`${v}/10`,               desc:'Density restrictions at local level. Primary barrier to housing supply in coastal metros.'},
      {id:'fedLandPermit',   label:'Federal Land Permitting',     min:1,   max:10,  step:1,   fmt:v=>`${v}/10`,               desc:'Access to federal land for development. Major lever in Mountain West and Sun Belt.'},
      {id:'pti',             label:'Price-to-Income Ratio',       min:3,   max:14,  step:0.5, fmt:v=>`${(+v).toFixed(1)}x`,  desc:'Median home price / median HH income. Historical avg ~3.5x. US now ~7x; coastal metros 10-14x.'},
      {id:'vacancyRate',     label:'Vacancy Rate (%)',            min:1,   max:12,  step:0.5, fmt:v=>`${(+v).toFixed(1)}%`,  desc:'Share of housing stock vacant. Low vacancy = tight market = upward price pressure.'},
      {id:'commercialREStress',label:'Commercial RE Stress',      min:1,   max:10,  step:1,   fmt:v=>`${v}/10`,               desc:'Office vacancies, CRE loan delinquencies. Threatens regional bank balance sheets.'},
      {id:'housingAct',      label:'Housing Act Implementation',  min:0,   max:10,  step:1,   fmt:v=>+v===0?'Not enacted':`${v}/10`,desc:'21st Century Road to Housing Act — federal incentives to build. Each unit = implementation progress.'},
    ]
  },
  { id:'labor', label:'Labor Market', icon:'◐',
    desc:'Employment, wages, skills, immigration, and workforce structure — the labor side of the growth equation.',
    sliders:[
      {id:'unemp',          label:'Unemployment Rate',           min:2,   max:15,  step:0.1, fmt:v=>`${(+v).toFixed(1)}%`,  desc:'U-3 headline. Fed dual mandate target ~4.0%. Okun\'s Law: 1% unemployment = ~-0.15% GDP.'},
      {id:'lfp',            label:'Labor Force Participation (%)',min:55, max:70,  step:0.5, fmt:v=>`${(+v).toFixed(1)}%`,  desc:'Share of working-age in labor force. Pre-2008 peak: 66%. Aging demographics create structural drag.'},
      {id:'minWage',        label:'Federal Minimum Wage ($/hr)', min:7.25,max:25,  step:0.25,fmt:v=>`$${(+v).toFixed(2)}`,  desc:'Federal floor unchanged since 2009. Many cities/states far exceed this. Wage floor affects CPI.'},
      {id:'unionMem',       label:'Union Membership (%)',        min:5,   max:35,  step:1,   fmt:v=>`${v}%`,                 desc:'Unionization rate. Drives wage floors and labor market rigidity. Currently at historic lows (~10%).'},
      {id:'highSkillImmig', label:'High-Skill Immigration (index)',min:1, max:10,  step:1,   fmt:v=>`${v}/10`,               desc:'H-1B, EB-5, O-1 policy generosity. Critical for tech/biotech/finance talent pipeline.'},
      {id:'autoDisplace',   label:'Automation Displacement Rate',min:1,   max:10,  step:1,   fmt:v=>`${v}/10`,               desc:'Speed of AI/robot job displacement. Creates structural unemployment if skills gap is large.'},
      {id:'skillsGap',      label:'Skills Gap Severity',         min:1,   max:10,  step:1,   fmt:v=>`${v}/10`,               desc:'Mismatch between available workers and employer needs. Major bottleneck for growth and investment.'},
      {id:'noncompete',     label:'Noncompete Enforcement',      min:1,   max:10,  step:1,   fmt:v=>`${v}/10`,               desc:'Higher enforcement = less labor mobility, less startup formation, lower wage competition.'},
    ]
  },
  { id:'energy', label:'Energy & Commodities', icon:'⬡',
    desc:'Oil, natural gas, electricity, renewables — core inflation inputs and industrial competitiveness drivers.',
    sliders:[
      {id:'oil',          label:'Crude Oil Price ($/bbl)',       min:30,  max:200, step:1,   fmt:v=>`$${v}`,                 desc:'WTI spot price. ~$10 change → ~0.15% CPI. Central variable linking geopolitics to inflation.'},
      {id:'natgas',       label:'Natural Gas ($/MMBtu)',         min:1,   max:20,  step:0.5, fmt:v=>`$${(+v).toFixed(1)}`,  desc:'Henry Hub. Drives electricity costs, industrial production, winter heating. Very seasonal.'},
      {id:'electricCost', label:'Electricity Cost Index',        min:1,   max:10,  step:1,   fmt:v=>`${v}/10`,               desc:'Industrial and residential power costs. High costs hurt manufacturing competitiveness vs. Asia.'},
      {id:'renewableShare',label:'Renewable Capacity Share (%)', min:5,   max:70,  step:1,   fmt:v=>`${v}%`,                 desc:'Wind + solar + hydro of US power. Long-run deflationary; short-run requires grid investment.'},
      {id:'carbonPolicy', label:'Carbon Policy Stringency',      min:1,   max:10,  step:1,   fmt:v=>`${v}/10`,               desc:'Carbon taxes/cap-and-trade. Short-run inflationary; long-run efficiency gains and energy security.'},
      {id:'spr',          label:'Strategic Petroleum Reserve (%)',min:15, max:100, step:5,   fmt:v=>`${v}%`,                 desc:'SPR fill level (max 713M barrels). Drawdowns can dampen price spikes. Currently rebuilding.'},
      {id:'lngExport',    label:'LNG Export Capacity',           min:1,   max:10,  step:1,   fmt:v=>`${v}/10`,               desc:'US liquefied natural gas export terminals. Revenue source + energy diplomacy with EU allies.'},
      {id:'oilConflict',  label:'Middle East Supply Risk',       min:1,   max:10,  step:1,   fmt:v=>`${v}/10`,               desc:'Iran, Yemen, Strait of Hormuz risk. Directly maps to oil price volatility premium.'},
    ]
  },
  { id:'infra', label:'Infrastructure & CAPEX', icon:'⬛',
    desc:'Capital investment, permitting speed, shipping costs, ports, grid reliability — the physical economy.',
    sliders:[
      {id:'privateCapex',  label:'Private CAPEX (% of GDP)',     min:10,  max:25,  step:0.5, fmt:v=>`${(+v).toFixed(1)}%`,  desc:'Private business fixed investment. Strongest leading indicator of future productivity growth.'},
      {id:'infraSpend',    label:'Infrastructure Spending ($B/yr)',min:100,max:1200,step:25,  fmt:v=>`$${v}B`,               desc:'Federal + state infrastructure. IIJA authorized $1.2T over 5 years. Roads, rail, grid, broadband.'},
      {id:'permitSpeed',   label:'Federal Permitting Speed',      min:1,   max:10,  step:1,   fmt:v=>`${v}/10`,               desc:'NEPA review timelines. A 2-year permit takes 4-7 years in practice. Reform = massive CAPEX unlock.'},
      {id:'localPermit',   label:'Local Permitting Speed',        min:1,   max:10,  step:1,   fmt:v=>`${v}/10`,               desc:'Building permits at city/county level. Critical bottleneck for housing AND industrial siting.'},
      {id:'shippingCost',  label:'Shipping/Freight Cost Index',   min:1,   max:10,  step:1,   fmt:v=>`${v}/10`,               desc:'Container rates, trucking costs, port congestion. Post-COVID has normalized but remains elevated.'},
      {id:'portEff',       label:'Port Efficiency Index',         min:1,   max:10,  step:1,   fmt:v=>`${v}/10`,               desc:'US port throughput vs. global peers. Chronic lag vs. Rotterdam and Singapore costs US competitiveness.'},
      {id:'broadband',     label:'Broadband Penetration (%)',     min:60,  max:100, step:1,   fmt:v=>`${v}%`,                 desc:'Households with high-speed access. Critical for remote work, digital economy, rural inclusion.'},
      {id:'gridReliability',label:'Grid Reliability Index',       min:1,   max:10,  step:1,   fmt:v=>`${v}/10`,               desc:'Power grid resilience. AI data centers creating massive new demand. Blackouts = GDP loss.'},
    ]
  },
  { id:'state', label:'State & Local Policy', icon:'◈',
    desc:'Tax competition, regulation, interstate migration, and subnational fiscal health — often overlooked macro driver.',
    sliders:[
      {id:'stateCorpTax',    label:'Avg State Corporate Tax (%)',  min:0,   max:12,  step:0.5, fmt:v=>`${(+v).toFixed(1)}%`,  desc:'Average state corporate income tax. Ranges: 0% (SD, WY, NV) to 11.5% (NJ). Location decisions.'},
      {id:'stateRegEnv',     label:'State Regulatory Environment', min:1,   max:10,  step:1,   fmt:v=>`${v}/10`,               desc:'Composite state-level regulatory burden. CA/NY (high) vs TX/FL (low). Divergence accelerating.'},
      {id:'interstateMigration',label:'Migration to Low-Tax States',min:1,  max:10,  step:1,   fmt:v=>`${v}/10`,               desc:'Net domestic migration to Sun Belt/low-tax states. Reallocates labor, capital, and tax base.'},
      {id:'stateFiscalHealth',label:'State Fiscal Health Index',   min:1,   max:10,  step:1,   fmt:v=>`${v}/10`,               desc:'Pension funding ratios, unfunded liabilities, credit ratings. Underfunded = future tax hikes.'},
      {id:'localPermitState', label:'State Housing Reform Progress',min:1,  max:10,  step:1,   fmt:v=>`${v}/10`,               desc:'Zoning reform, ADU legalization, by-right permitting. CA SB9, MT HB 382 examples.'},
      {id:'propTax',          label:'Avg Property Tax Rate (%)',   min:0.3, max:3.5, step:0.1, fmt:v=>`${(+v).toFixed(1)}%`,  desc:'Effective property tax. NJ ~2.5%, HI ~0.3%. Major component of housing carrying costs.'},
      {id:'rightToWork',      label:'Right-to-Work Coverage (%)',  min:30,  max:80,  step:5,   fmt:v=>`${v}%`,                 desc:'Share of US workers in RTW states. Affects union density, labor costs, and business location.'},
    ]
  },
  { id:'politecon', label:'Political Economy', icon:'◎',
    desc:'Policy certainty, institutional quality, rule of law — the most underrated driver of long-run economic outcomes.',
    warn:'⚠ UNDERRATED: Political economy factors account for an estimated 20-40% of cross-country growth variance. Invisible in standard models, but decisive over time horizons >3 years.',
    sliders:[
      {id:'policyCert',     label:'Policy Certainty Index',       min:1,   max:10,  step:1,   fmt:v=>`${v}/10`,               desc:'Baker-Bloom-Davis EPU (inverted). Uncertainty = deferred CAPEX and hiring. Currently elevated.'},
      {id:'polarization',   label:'Political Polarization',       min:1,   max:10,  step:1,   fmt:v=>`${v}/10`,               desc:'Congressional gridlock, societal division. Legislates through crises, not planning. Currently ~8/10.'},
      {id:'ruleOfLaw',      label:'Rule of Law Strength',         min:1,   max:10,  step:1,   fmt:v=>`${v}/10`,               desc:'Property rights, contract enforcement, judicial independence. Foundation of long-term investment.'},
      {id:'govEffective',   label:'Government Effectiveness',     min:1,   max:10,  step:1,   fmt:v=>`${v}/10`,               desc:'Bureaucratic quality, public service delivery. Affects permitting execution, spending efficiency.'},
      {id:'cbIndependence', label:'Central Bank Independence',    min:1,   max:10,  step:1,   fmt:v=>`${v}/10`,               desc:'Political insulation of the Fed. Erosion raises inflation risk premium in long-term bonds.'},
      {id:'socialCapital',  label:'Social Capital (Trust Index)', min:1,   max:10,  step:1,   fmt:v=>`${v}/10`,               desc:'Putnam: trust in institutions, civic participation. Predicts investment, cooperation, long-run growth.'},
      {id:'regCapture',     label:'Regulatory Capture Risk',      min:1,   max:10,  step:1,   fmt:v=>`${v}/10`,               desc:'Degree regulators serve industry vs. public interest. Distorts markets, suppresses competition.'},
      {id:'mediaQuality',   label:'Information Quality Index',    min:1,   max:10,  step:1,   fmt:v=>`${v}/10`,               desc:'Media independence, misinformation prevalence. Low quality → policy dysfunction and misallocation.'},
      {id:'electoralStab',  label:'Electoral Stability',          min:1,   max:10,  step:1,   fmt:v=>`${v}/10`,               desc:'Legitimacy of elections and transitions. Instability raises risk premia across all asset classes.'},
    ]
  },
  { id:'geopolitics', label:'Geopolitical Risk', icon:'⊕',
    desc:'Global conflicts, alliance structures, strategic competition, and dollar reserve status.',
    sliders:[
      {id:'conflictIndex',    label:'Global Conflict Index',       min:1,   max:10,  step:1,   fmt:v=>`${v}/10`,               desc:'Active conflicts affecting trade, energy, and capital flows. Currently elevated.'},
      {id:'natoCommit',       label:'NATO Commitment Strength',    min:1,   max:10,  step:1,   fmt:v=>`${v}/10`,               desc:'US commitment to Article 5. Lower commitment shifts burden to Europe, affects defense budgets.'},
      {id:'chinaMilRisk',     label:'China Military Risk (Taiwan)',min:1,   max:10,  step:1,   fmt:v=>`${v}/10`,               desc:'Taiwan Strait, South China Sea. Escalation scenario would dwarf 2008 financial crisis in scope.'},
      {id:'energyGeopolitics',label:'Energy Supply Chain Fragility',min:1,  max:10,  step:1,   fmt:v=>`${v}/10`,               desc:'Risk of oil/LNG/critical mineral supply disruption. Iran, Russia, and Hormuz key chokepoints.'},
      {id:'dollarReserve',    label:'Dollar Reserve Currency Status',min:1,  max:10, step:1,   fmt:v=>`${v}/10`,               desc:'USD share of global FX reserves. Erosion raises US borrowing costs and reduces policy space.'},
      {id:'cyberRisk',        label:'Cyber Security Risk',         min:1,   max:10,  step:1,   fmt:v=>`${v}/10`,               desc:'State-sponsored attacks on financial system, grid, and infrastructure. Systemic and underpriced risk.'},
      {id:'allyRelations',    label:'Allied Relations Index',      min:1,   max:10,  step:1,   fmt:v=>`${v}/10`,               desc:'US relations with Five Eyes, EU, Japan, South Korea. Affects trade, tech cooperation, and security.'},
    ]
  },
];

const ANALYSIS_SECTIONS = [
  { id:'data-copilot',label:'Data Copilot', icon:'↻' },
  { id:'observed',    label:'Official Data', icon:'◉' },
  { id:'calendar',    label:'Economic Calendar', icon:'▤' },
  { id:'surprises',   label:'Release Surprises', icon:'⇄' },
  { id:'news',        label:'Live News Intelligence', icon:'◒' },
  { id:'events',      label:'Events & Shocks', icon:'◬' },
  { id:'portfolio',   label:'Portfolio Lab', icon:'▦' },
  { id:'branches',    label:'Scenario Tree', icon:'⑂' },
  { id:'analyst',     label:'Ask MACROSCOPE', icon:'✦' },
  { id:'charts',      label:'Charts & Analysis', icon:'◫' },
  { id:'scenarios',   label:'Scenarios', icon:'◩' },
  { id:'sensitivity', label:'Sensitivity Analysis', icon:'◧' },
  { id:'calibrate',   label:'2026 Q2 Calibration', icon:'◎' },
  { id:'history',     label:'Historical Scenarios', icon:'◑' },
  { id:'compare',     label:'Country Compare', icon:'◈' },
];

// ── PRESET EVENTS ────────────────────────────────────────────────
const EVENTS = [
  // Housing
  {id:'housing_act',      label:'21st Century Road to Housing Act signed', cat:'Housing',     pos:true,  chips:['GDP +0.2%','CPI -0.1%','Supply +0.3M'],  d:{housingSupply:0.3,housingAct:5,  gdpA:0.20,cpiA:-0.10}},
  {id:'rent_ctrl',        label:'National rent control enacted',            cat:'Housing',     pos:false, chips:['Supply -0.3M','GDP -0.15%'],              d:{housingSupply:-0.3,              gdpA:-0.15,cpiA:0.05}},
  {id:'zoning_reform',    label:'Federal zoning override — by-right builds',cat:'Housing',     pos:true,  chips:['Zoning -3','Supply +0.4M','Aff. +8pts'],  d:{zoning:-3,housingSupply:0.4,    gdpA:0.15}},
  // Energy
  {id:'iran_end',         label:'End of Iran conflict — oil shock reversal', cat:'Energy',     pos:true,  chips:['Oil -$18','CPI -0.4%','GDP +0.3%'],       d:{oil:-18,oilConflict:-3,          gdpA:0.30,cpiA:-0.40}},
  {id:'oil_shock',        label:'OPEC+ major supply cut — oil +$35/bbl',    cat:'Energy',     pos:false, chips:['Oil +$35','CPI +0.8%','GDP -0.5%'],       d:{oil:35,                          gdpA:-0.50,cpiA:0.80}},
  {id:'pipeline_ok',      label:'Major pipeline network approved & built',  cat:'Energy',     pos:true,  chips:['Gas -$0.8','CPI -0.1%'],                   d:{natgas:-0.8,lngExport:1,        gdpA:0.15,cpiA:-0.10}},
  {id:'spr_big',          label:'Large SPR release (100M bbl)',             cat:'Energy',     pos:true,  chips:['Oil -$10','CPI -0.15%'],                   d:{oil:-10,spr:-15,                gdpA:0.10,cpiA:-0.15}},
  {id:'carbon_tax',       label:'$100/ton carbon tax enacted',              cat:'Energy',     pos:false, chips:['CPI +0.4%','GDP -0.2%','Renew. +5%'],     d:{carbonPolicy:3,renewableShare:5, gdpA:-0.20,cpiA:0.40}},
  // Monetary (Warsh)
  {id:'warsh_cuts3',      label:'Warsh signals 3 rate cuts this year',     cat:'Monetary',   pos:true,  chips:['FFR -0.75%','GDP +0.35%','S&P +7%'],      d:{ffr:-0.75,                       gdpA:0.35,cpiA:0.15,spA:7}},
  {id:'warsh_hike75',     label:'Emergency rate hike +75bps',              cat:'Monetary',   pos:false, chips:['FFR +0.75%','GDP -0.4%','S&P -9%'],       d:{ffr:0.75,                        gdpA:-0.40,cpiA:-0.20,spA:-9}},
  {id:'warsh_qt_accel',   label:'Warsh accelerates QT to $150B/mo',        cat:'Monetary',   pos:false, chips:['Balance sheet -$1.8T/yr','S&P -5%'],       d:{qePace:-25,                      gdpA:-0.20,spA:-5}},
  {id:'warsh_taylor',     label:'Warsh formally adopts Taylor Rule',        cat:'Monetary',   pos:true,  chips:['Policy cert +2','GDP +0.15%','S&P +3%'],   d:{warshrules:3,policyCert:2,       gdpA:0.15,spA:3}},
  {id:'fed_independence', label:'White House pressures Fed on rates',       cat:'Monetary',   pos:false, chips:['CB independence -2','Risk prem. rises'],   d:{cbIndependence:-2,               gdpA:-0.20,cpiA:0.15,spA:-6}},
  {id:'ycc_intro',        label:'Fed introduces Yield Curve Control',       cat:'Monetary',   pos:false, chips:['YCC +5','CPI +0.5%','Yields capped'],      d:{ycc:5,                           gdpA:0.10,cpiA:0.50,spA:5}},
  // Trade
  {id:'eu_deal',          label:'EU-US Free Trade Agreement ratified',      cat:'Trade',      pos:true,  chips:['Tariff -3%','GDP +0.4%','FDI +1'],         d:{tariff:-3,fdiInflows:1,          gdpA:0.40,cpiA:-0.15}},
  {id:'china_tariff60',   label:'60% tariffs on all Chinese goods',        cat:'Trade',      pos:false, chips:['Tariff +15%','CPI +0.9%','GDP -0.6%'],     d:{tariff:15,shippingCost:2,        gdpA:-0.60,cpiA:0.90}},
  {id:'china_rare_earth', label:'China bans rare earth exports to US',      cat:'Trade',      pos:false, chips:['Decoupling +2','GDP -0.4%'],               d:{chinaDecoupling:2,               gdpA:-0.40,cpiA:0.30}},
  {id:'usmca_renegotiate',label:'USMCA renegotiated — nearshoring surge',   cat:'Trade',      pos:true,  chips:['Nearshoring +3','GDP +0.25%'],             d:{nearshoring:3,                   gdpA:0.25,cpiA:-0.05}},
  {id:'dollar_dump',      label:'BRICS nations dump USD reserves',          cat:'Trade',      pos:false, chips:['DXY -10','Reserve status -2','CPI +0.3%'], d:{dxy:-10,dollarReserve:-2,        gdpA:-0.25,cpiA:0.30}},
  // Fiscal
  {id:'stimulus2t',       label:'$2T fiscal stimulus package',              cat:'Fiscal',     pos:true,  chips:['GDP +0.6%','CPI +0.5%','Deficit +1.5%'],  d:{govSpend:3,deficit:1.5,          gdpA:0.60,cpiA:0.50,spA:5}},
  {id:'austerity_big',    label:'$500B/yr spending cuts enacted',           cat:'Fiscal',     pos:false, chips:['GDP -0.4%','Deficit -2%','CPI -0.1%'],     d:{govSpend:-3,deficit:-2,          gdpA:-0.40,cpiA:-0.10}},
  {id:'debt_ceiling',     label:'Debt ceiling crisis — brink of default',   cat:'Fiscal',     pos:false, chips:['GDP -0.9%','S&P -15%','Policy cert -2'],   d:{policyCert:-2,foreignDemand:-2,  gdpA:-0.90,cpiA:0.20,spA:-15}},
  {id:'corp_tax_cut',     label:'Corporate tax cut to 15%',                 cat:'Fiscal',     pos:true,  chips:['Corp tax -6%','GDP +0.5%','S&P +8%'],      d:{corpTax:-6,                      gdpA:0.50,spA:8}},
  {id:'permitting_reform',label:'NEPA reform — 90-day federal reviews',     cat:'Fiscal',     pos:true,  chips:['Permit speed +3','CAPEX +0.8%','GDP +0.3%'],d:{permitSpeed:3,privateCapex:0.8, gdpA:0.30}},
  // Innovation
  {id:'ai_boom',          label:'AI productivity boom — economy-wide',      cat:'Innovation', pos:true,  chips:['TFP +0.5%','GDP +0.8%','S&P +12%'],       d:{aiAdoption:3,innovRate:0.5,      gdpA:0.80,cpiA:-0.20,spA:12}},
  {id:'chips_act2',       label:'CHIPS Act 2.0 — fab expansion surge',      cat:'Innovation', pos:true,  chips:['R&D +0.3%','CAPEX +1%','GDP +0.3%'],       d:{rdSpend:0.3,privateCapex:1,      gdpA:0.30,spA:5}},
  {id:'stem_exodus',      label:'STEM talent exodus to other countries',     cat:'Innovation', pos:false, chips:['TFP -0.3%','VC -$50B','GDP -0.2%'],       d:{stemGrowth:-2,vcFunding:-50,     gdpA:-0.20}},
  // Geopolitical
  {id:'taiwan_crisis',    label:'Taiwan Strait military escalation',         cat:'Geopolit.',  pos:false, chips:['GDP -1.2%','Oil +$25','S&P -20%'],         d:{oil:25,conflictIndex:2,          gdpA:-1.20,cpiA:0.60,spA:-20}},
  {id:'ukraine_peace',    label:'Russia-Ukraine comprehensive ceasefire',    cat:'Geopolit.',  pos:true,  chips:['Gas -$1.5','Oil -$8','GDP +0.4%'],         d:{natgas:-1.5,oil:-8,conflictIndex:-2,gdpA:0.40}},
  {id:'nato_collapse',    label:'NATO credibility collapse',                 cat:'Geopolit.',  pos:false, chips:['Defense +1.5% GDP','Uncertainty up'],      d:{natoCommit:-3,defenseSpend:1.5,  gdpA:-0.50,spA:-10}},
  // Labor
  {id:'fed_layoffs',      label:'Large-scale federal workforce reductions',  cat:'Labor',      pos:false, chips:['Unemp +0.4%','GovSpend -1%'],              d:{unemp:0.4,govSpend:-1,           gdpA:-0.20}},
  {id:'highskill_expand', label:'Major high-skill visa expansion (H-1B 3×)', cat:'Labor',      pos:true,  chips:['TFP +0.2%','Stem +1%','GDP +0.4%'],        d:{highSkillImmig:3,stemGrowth:1,   gdpA:0.40}},
  // Infrastructure
  {id:'port_strike',      label:'Major US port strike — 6-week shutdown',    cat:'Infra.',     pos:false, chips:['Shipping +3','CPI +0.4%','GDP -0.3%'],     d:{shippingCost:3,                  gdpA:-0.30,cpiA:0.40}},
  // Political Economy
  {id:'const_crisis',     label:'Constitutional/institutional crisis',        cat:'Pol. Econ.', pos:false, chips:['Rule of law -2','S&P -12%','GDP -0.7%'],  d:{ruleOfLaw:-2,electoralStab:-2,   gddA:-0.70,spA:-12}},
  {id:'bipartisan_deal',  label:'Bipartisan infrastructure + fiscal deal',    cat:'Pol. Econ.', pos:true,  chips:['Policy cert +3','GDP +0.5%','S&P +6%'],   d:{policyCert:3,infraSpend:150,     gdpA:0.50,spA:6}},
  // ── POSITIVE SHOCKS (new) ────────────────────────────────────────
  {id:'china_bargain',    label:'US-China grand bargain — full tariff rollback + tech licensing', cat:'Trade',      pos:true,
   chips:['Tariff -10%','GDP +0.5%','CPI -0.3%','FDI +2'],
   d:{tariff:-10, chinaDecoupling:-3, fdiInflows:2, nearshoring:1, gdpA:0.50, cpiA:-0.30}},

  {id:'stem_greencards',  label:'STEM green card reform — automatic residency for US graduates', cat:'Labor',       pos:true,
   chips:['Hi-skill +4','TFP +0.3%','GDP +0.4%'],
   d:{highSkillImmig:4, stemGrowth:2, innovRate:0.3, gdpA:0.40}},

  {id:'zoning_federal',   label:'National zoning preemption — federal override of exclusionary zoning', cat:'Housing', pos:true,
   chips:['Zoning -4','Supply +0.5M','Afford. +10pts'],
   d:{zoning:-4, housingSupply:0.5, localPermitState:3, housingAct:3, gdpA:0.25, cpiA:-0.10}},

  {id:'ss_reform',        label:'Social Security structural reform — 75-year actuarial solvency', cat:'Fiscal',     pos:true,
   chips:['Deficit -1.5%','Policy cert +2','GDP +0.3%'],
   d:{deficit:-1.5, policyCert:2, socialCapital:1, gdpA:0.30}},

  {id:'nuclear_smr',      label:'Nuclear renaissance — 20 SMR approvals, construction begins', cat:'Energy',      pos:true,
   chips:['Elec cost -2','Renew +5%','GDP +0.3%','Grid +2'],
   d:{electricCost:-2, renewableShare:5, gridReliability:2, carbonPolicy:1, gdpA:0.30, cpiA:-0.15}},

  {id:'rare_earth_secure',label:'Domestic rare earth supply secured — end China mineral dependency', cat:'Trade',    pos:true,
   chips:['Energy geo -1','CAPEX +1%','GDP +0.25%'],
   d:{energyGeopolitics:-1, chinaDecoupling:-1, privateCapex:1, gdpA:0.25}},

  {id:'reshoring_mega',   label:'Reshoring mega-incentive — $500B manufacturing tax credits', cat:'Trade',          pos:true,
   chips:['Nearshoring +3','CAPEX +1.5%','GDP +0.4%'],
   d:{nearshoring:3, privateCapex:1.5, chinaDecoupling:1, gdpA:0.40, cpiA:0.10}},

  {id:'sovereign_fund',   label:'US sovereign wealth fund launched — federal royalties invested', cat:'Fiscal',    pos:true,
   chips:['CAPEX +0.5%','Deficit -0.5%','GDP +0.2%'],
   d:{privateCapex:0.5, deficit:-0.5, policyCert:1, gdpA:0.20}},

  {id:'mexico_energy_pact',label:'US-Mexico energy partnership — LNG + manufacturing hub', cat:'Trade',            pos:true,
   chips:['Nearshoring +3','LNG +2','Gas -$0.5','GDP +0.35%'],
   d:{nearshoring:3, lngExport:2, natgas:-0.5, gdpA:0.35, cpiA:-0.10}},

  {id:'drug_pricing',     label:'Drug pricing reform — Medicare negotiation + biosimilar surge', cat:'Labor',       pos:true,
   chips:['LFP +0.5%','CAPEX +0.5%','CPI -0.15%','GDP +0.25%'],
   d:{lfp:0.5, privateCapex:0.5, gdpA:0.25, cpiA:-0.15}},

  {id:'ai_governance',    label:'Global AI governance framework — G7 regulatory certainty achieved', cat:'Innovation', pos:true,
   chips:['AI adoption +2','TFP +0.3%','GDP +0.4%'],
   d:{aiAdoption:2, innovRate:0.3, policyCert:1, gdpA:0.40}},

  {id:'permit_overhaul',  label:'Comprehensive permitting overhaul — all federal reviews capped at 1yr', cat:'Fiscal', pos:true,
   chips:['Permit +4','CAPEX +1.5%','GDP +0.5%'],
   d:{permitSpeed:4, fedPermit:3, localPermit:2, privateCapex:1.5, gdpA:0.50}},

  {id:'broadband_100pct', label:'Rural broadband completion — 100% high-speed coverage achieved', cat:'Infra.',    pos:true,
   chips:['Broadband 100%','LFP +0.5%','GDP +0.2%'],
   d:{broadband:18, lfp:0.5, gdpA:0.20}},

  {id:'pension_bipartisan',label:'Bipartisan state pension reform — unfunded liabilities federally addressed', cat:'State', pos:true,
   chips:['State health +3','Policy cert +1','GDP +0.25%'],
   d:{stateFiscalHealth:3, policyCert:1, stateCorpTax:-0.5, gdpA:0.25}},

  {id:'semicon_independence',label:'US semiconductor self-sufficiency achieved — CHIPS Act dividend realized', cat:'Innovation', pos:true,
   chips:['R&D +0.3%','Decoupling risk -2','GDP +0.3%'],
   d:{rdSpend:0.3, innovRate:0.2, chinaDecoupling:-2, energyGeopolitics:-1, gdpA:0.30}},

  // ── NEGATIVE SHOCKS (new) ────────────────────────────────────────
  {id:'credit_downgrade',  label:'US sovereign credit downgrade — Moody’s + S&P cut to AA', cat:'Bonds',        pos:false,
   chips:['Foreign demand -3','Term prem +80bps','GDP -0.5%','S&P -10%'],
   d:{foreignDemand:-3, termPremium:80, dollarReserve:-2, ruleOfLaw:-1, gdpA:-0.50, spA:-10}},

  {id:'regional_bank_cascade',label:'Regional banking cascade — 20+ mid-size bank failures (CRE losses)', cat:'Bonds', pos:false,
   chips:['HY +400bps','IG +150bps','GDP -0.7%','S&P -12%'],
   d:{hySpreads:400, igSpreads:150, commercialREStress:3, creditImpulse:-3, gdpA:-0.70, spA:-12}},

  {id:'china_hard_landing', label:'China hard landing — GDP collapses to ~1%, global demand shock', cat:'Trade',  pos:false,
   chips:['Oil -$15','FDI -2','GDP -0.5%'],
   d:{oil:-15, fdiInflows:-2, chinaDecoupling:1, tradeBalance:-1, gdpA:-0.50}},

  {id:'swift_cyberattack',  label:'SWIFT cyberattack — state-sponsored, 3-day banking system freeze', cat:'Geopolit.', pos:false,
   chips:['Credit impulse -3','Policy cert -2','GDP -0.6%','S&P -8%'],
   d:{creditImpulse:-3, policyCert:-2, cyberRisk:2, gdpA:-0.60, spA:-8}},

  {id:'ss_depletion',       label:'Social Security depletion — automatic 23% benefit cuts', cat:'Fiscal', pos:false,
   chips:['Gov spend -3','Unemp +0.5%','GDP -0.5%'],
   d:{govSpend:-3, unemp:0.5, polarization:1, gdpA:-0.50, cpiA:-0.10}},

  {id:'ai_displacement_surge',label:'Mass white-collar AI displacement — 15M professional jobs automated', cat:'Labor', pos:false,
   chips:['Unemp +2.5%','Skills gap +2','GDP -0.4%'],
   d:{autoDisplace:3, unemp:2.5, skillsGap:2, gdpA:-0.40}},

  {id:'stagflation_spiral', label:'Stagflation spiral — supply shock + unanchored expectations + fiscal excess', cat:'Energy', pos:false,
   chips:['Oil +$25','CPI +0.8%','HY +200bps','GDP -0.5%'],
   d:{oil:25, hySpreads:200, gdpA:-0.50, cpiA:0.80}},

  {id:'iran_direct_conflict',label:'US-Iran direct military conflict — Hormuz partially blocked', cat:'Geopolit.', pos:false,
   chips:['Oil +$45','CPI +1.0%','GDP -0.7%','S&P -15%'],
   d:{oil:45, oilConflict:3, conflictIndex:2, lngExport:-2, gdpA:-0.70, cpiA:1.00, spA:-15}},

  {id:'state_pension_cascade',label:'State pension cascade — IL, NJ, CT seek simultaneous federal bailout', cat:'State', pos:false,
   chips:['State health -3','Deficit +1.5%','GDP -0.35%'],
   d:{stateFiscalHealth:-3, deficit:1.5, stateCorpTax:1, policyCert:-1, gdpA:-0.35}},

  {id:'brics_dollar_exit',  label:'BRICS+ payment system reaches critical mass — dollar reserves fall 8pts', cat:'Trade', pos:false,
   chips:['Reserve status -3','DXY -8','CPI +0.4%','GDP -0.3%'],
   d:{dollarReserve:-3, foreignDemand:-2, dxy:-8, gdpA:-0.30, cpiA:0.40}},

  {id:'major_bank_failure', label:'Systemic US bank failure — top-10 bank collapses (Bear Stearns scale)', cat:'Bonds', pos:false,
   chips:['HY +600bps','IG +250bps','GDP -1.0%','S&P -18%'],
   d:{hySpreads:600, igSpreads:250, creditImpulse:-4, commercialREStress:2, gdpA:-1.00, spA:-18}},

  {id:'climate_cluster',    label:'Climate disaster cluster — three Cat-5 hurricanes + western megadrought', cat:'Geopolit.', pos:false,
   chips:['Deficit +1%','Shipping +2','CPI +0.3%','GDP -0.4%'],
   d:{deficit:1, shippingCost:2, oil:8, infraSpend:150, gdpA:-0.40, cpiA:0.30}},

  {id:'pandemic2',          label:'Pandemic 2.0 — novel respiratory pathogen, 60% more transmissible than COVID', cat:'Geopolit.', pos:false,
   chips:['GDP -2.5%','Unemp +4%','Oil -$20','S&P -25%'],
   d:{unemp:4, lfp:-3, oil:-20, govSpend:8, deficit:8, hySpreads:500, gdpA:-2.50, spA:-25}},

  {id:'shutdown_6mo',       label:'6-month government shutdown — debt ceiling standoff, federal freeze', cat:'Fiscal', pos:false,
   chips:['Policy cert -3','Gov spend -5','GDP -0.5%','S&P -6%'],
   d:{govSpend:-5, unemp:0.5, policyCert:-3, foreignDemand:-1, gdpA:-0.50, spA:-6}},

  {id:'demographic_cliff',  label:'Demographic cliff accelerates — full Boomer labor market exit', cat:'Labor',    pos:false,
   chips:['LFP -2.5%','Skills gap +2','GDP -0.3%','CPI +0.2%'],
   d:{lfp:-2.5, skillsGap:2, autoDisplace:1, gdpA:-0.30, cpiA:0.20}},

  // ── EUROZONE EVENTS ─────────────────────────────────────────────
  {id:'ecb_qe_emergency',   label:'ECB emergency QE (PEPP-style, €1T)',              cat:'EU – Monetary',   pos:true,
   chips:['QE +80B/mo','10yr -0.5%','GDP +0.4%'],   d:{qePace:80, gdpA:0.40, cpiA:0.20}},
  {id:'eu_sovereign_crisis',label:'Eurozone sovereign crisis — BTP/Bund spread blows',cat:'EU – Bonds',     pos:false,
   chips:['Demand -3','Spreads +300bps','GDP -0.6%'],d:{foreignDemand:-3, igSpreads:150, hySpreads:300, gdpA:-0.60, spA:-12}},
  {id:'german_debt_brake',  label:'Germany removes constitutional debt brake',              cat:'EU – Fiscal',    pos:true,
   chips:['Deficit +2%','Spend +4%','GDP +0.5%'],   d:{deficit:2, govSpend:4, privateCapex:1, gdpA:0.50}},
  {id:'eu_ai_act_strict',   label:'EU AI Act — most restrictive provisions enforced', cat:'EU – Regulation',pos:false,
   chips:['AI -2','Innov -0.3%','GDP -0.2%'],       d:{aiAdoption:-2, innovRate:-0.3, gdpA:-0.20}},
  {id:'eu_energy_union',    label:'EU Energy Union completed — shared grid + LNG',   cat:'EU – Energy',    pos:true,
   chips:['Energy geo -2','Elec -1','GDP +0.3%'],   d:{energyGeopolitics:-2, electricCost:-1, renewableShare:5, gdpA:0.30, cpiA:-0.10}},
  // ── CHINA EVENTS ─────────────────────────────────────────────────
  {id:'pboc_major_stimulus',label:'PBoC + NDRC mega-stimulus — ¥10T package',   cat:'CN – Monetary',  pos:true,
   chips:['QE +50B/mo','Spend +4%','GDP +0.8%'],    d:{qePace:50, govSpend:4, creditImpulse:2, gdpA:0.80, cpiA:0.30}},
  {id:'china_prop_collapse',label:'China property sector collapse — Evergrande cascade',cat:'CN – Housing', pos:false,
   chips:['CRE stress +3','Credit -3pp','GDP -1.2%'],d:{commercialREStress:3, creditImpulse:-3, hySpreads:300, housingSupply:-0.5, gdpA:-1.20, spA:-15}},
  {id:'china_ai_leap',      label:'China AI breakthrough — frontier model parity',   cat:'CN – Innovation',pos:true,
   chips:['AI +3','TFP +0.5%','GDP +0.5%'],         d:{aiAdoption:3, innovRate:0.5, vcFunding:50, gdpA:0.50}},
  {id:'china_deflation',    label:'China deflation trap — Japan-1990s style',         cat:'CN – Macro',    pos:false,
   chips:['CPI -1%','Credit -2pp','GDP -0.8%'],     d:{creditImpulse:-2.5, pti:-2, gdpA:-0.80, cpiA:-1.0}},
  // ── UK EVENTS ────────────────────────────────────────────────────
  {id:'boe_emergency_cut',  label:'BoE emergency rate cuts — 75bp in one meeting',   cat:'UK – Monetary',  pos:true,
   chips:['Rate -0.75%','Mortg -0.5%','GDP +0.3%'], d:{ffr:-0.75, gdpA:0.30}},
  {id:'uk_minibudget2',     label:'UK mini-budget crisis 2.0 — unfunded tax cuts',   cat:'UK – Fiscal',    pos:false,
   chips:['Demand -2','Deficit +3%','GDP -0.5%'],   d:{foreignDemand:-2, deficit:3, policyCert:-2, gdpA:-0.50, spA:-8}},
  {id:'uk_eu_reset',        label:'UK-EU trade reset — Single Market partial re-entry',cat:'UK – Trade',   pos:true,
   chips:['Tariff -4%','FDI +2','GDP +0.5%'],       d:{tariff:-4, fdiInflows:2, gdpA:0.50, cpiA:-0.15}},
  {id:'uk_greenbelt',       label:'UK Green Belt reform — major housing liberalisation',cat:'UK – Housing', pos:true,
   chips:['Supply +0.2M','Zoning -3','GDP +0.2%'],  d:{housingSupply:0.2, zoning:-3, housingAct:3, gdpA:0.20}},
  // ── JAPAN EVENTS ─────────────────────────────────────────────────
  {id:'boj_ycc_abandon',    label:'BoJ fully abandons YCC — 10yr yield freed',       cat:'JP – Monetary',  pos:false,
   chips:['YCC -5','10yr +0.8%','GDP -0.3%'],       d:{ycc:-5, termPremium:40, foreignDemand:-1, gdpA:-0.30, spA:-6}},
  {id:'japan_fiscal_crisis',label:'Japan fiscal credibility crisis — JGB selloff',   cat:'JP – Bonds',    pos:false,
   chips:['Demand -3','Term +100bps','GDP -0.7%'],  d:{foreignDemand:-3, termPremium:100, gdpA:-0.70, spA:-10}},
  {id:'japan_defense_surge',label:'Japan defense buildup to 2% GDP (NATO-equivalent)',    cat:'JP – Fiscal',   pos:true,
   chips:['Defense +0.5%','Tech spillover','GDP +0.2%'],d:{defenseSpend:0.5, innovRate:0.1, gdpA:0.20}},
  {id:'japan_immig_reform', label:'Japan major immigration reform — skilled worker surge',cat:'JP – Labor',pos:true,
   chips:['LFP +1%','Hi-skill +2','GDP +0.3%'],     d:{lfp:1, highSkillImmig:2, stemGrowth:1, gdpA:0.30}},
  // ── EMERGING MARKET EVENTS ────────────────────────────────────────
  {id:'em_fed_contagion',   label:'Fed tightening EM contagion — capital flight',    cat:'EM – Global',    pos:false,
   chips:['HY +300bps','FDI -2','GDP -0.7%'],       d:{hySpreads:300, fdiInflows:-2, creditImpulse:-2, dollarReserve:-1, gdpA:-0.70}},
  {id:'commodity_supercycle',label:'Commodity super-cycle — EM export boom',         cat:'EM – Trade',     pos:true,
   chips:['Oil +$20','FDI +2','GDP +0.6%'],         d:{oil:20, fdiInflows:2, tradeBalance:1.5, gdpA:0.60}},
  {id:'em_infra_boom',      label:'EM infrastructure decade — World Bank + DFI push',cat:'EM – CAPEX',    pos:true,
   chips:['CAPEX +2%','Infra +$150B','GDP +0.5%'],  d:{privateCapex:2, infraSpend:150, permitSpeed:2, gdpA:0.50}},
  {id:'em_debt_crisis',     label:'EM sovereign debt crisis — cascade default risk', cat:'EM – Bonds',    pos:false,
   chips:['RoL -1','FDI -2','HY +400bps','GDP -0.8%'],d:{ruleOfLaw:-1, fdiInflows:-2, hySpreads:400, creditImpulse:-2.5, gdpA:-0.80}},


];

// ═══════════════════════════════════════════════════════════════════
//  SHOCK ENGINE v4.2 — magnitude, timing, persistence, interactions
// ═══════════════════════════════════════════════════════════════════
const SHOCK_TYPE_DEFAULTS = {
  temporary:  { durationMonths:9,   peakMonth:2,  decayRate:0.28, confidence:0.72 },
  persistent: { durationMonths:36,  peakMonth:4,  decayRate:0.08, confidence:0.76 },
  structural: { durationMonths:120, peakMonth:12, decayRate:0.00, confidence:0.70 }
};

const SHOCK_TARGET_LABELS = {
  gdpA:'GDP direct effect', cpiA:'CPI direct effect', spA:'S&P proxy effect',
  ffr:'Policy rate', qePace:'QE / QT pace', oil:'WTI oil', natgas:'Natural gas',
  tariff:'Average tariff', shippingCost:'Shipping stress', portEff:'Port efficiency',
  unemp:'Unemployment', lfp:'Labor-force participation', highSkillImmig:'High-skill immigration',
  innovRate:'TFP benchmark', aiAdoption:'AI adoption', rdSpend:'R&D spending', stemGrowth:'STEM workforce growth',
  privateCapex:'Private CAPEX', infraSpend:'Infrastructure spending', housingSupply:'Housing supply', zoning:'Zoning restrictiveness',
  deficit:'Federal deficit', govSpend:'Government spending growth', corpTax:'Corporate tax',
  igSpreads:'IG credit spreads', hySpreads:'HY credit spreads', creditImpulse:'Credit impulse', termPremium:'Term premium',
  foreignDemand:'Foreign Treasury demand', dxy:'Dollar index', policyCert:'Policy certainty', ruleOfLaw:'Rule of law',
  cbIndependence:'Central-bank independence', conflictIndex:'Conflict index', chinaMilRisk:'China military risk',
  energyGeopolitics:'Energy geopolitics', commercialREStress:'Commercial real-estate stress', renewableShare:'Renewable share',
  gridReliability:'Grid reliability', fdiInflows:'FDI inflows', nearshoring:'Nearshoring progress',
  twoyrA:'2-year Treasury', tenyrA:'10-year Treasury', mortgA:'Mortgage rate', confA:'Consumer confidence', recessionRiskA:'Recession risk'
};

const CUSTOM_SHOCK_TARGETS = [
  'gdpA','cpiA','spA','ffr','oil','natgas','tariff','shippingCost','unemp','lfp',
  'innovRate','aiAdoption','privateCapex','housingSupply','deficit','govSpend',
  'igSpreads','hySpreads','creditImpulse','termPremium','foreignDemand','dxy',
  'policyCert','ruleOfLaw','conflictIndex','commercialREStress','gridReliability','nearshoring'
];

function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}

function inferShockType(ev) {
  if (ev.shockType) return ev.shockType;
  const t = (ev.id + ' ' + ev.label + ' ' + ev.cat).toLowerCase();
  if (/reform|act signed|tax cut|green card|zoning|self-sufficiency|partnership|governance|overhaul|completion|ratified|adopts|launched|permanent|productivity boom|demographic|immigration reform|visa expansion|talent exodus/.test(t)) return 'structural';
  if (/strike|conflict|crisis|collapse|pandemic|shutdown|cyber|hurricane|shock|failure|attack|escalation|freeze|default|ceasefire|spr release/.test(t)) return 'temporary';
  return 'persistent';
}

function inferShockGroup(ev, target) {
  const cat = String(ev.cat || '').toLowerCase();
  if (['igSpreads','hySpreads','creditImpulse','commercialREStress','foreignDemand','termPremium'].includes(target) || /bond/.test(cat)) return 'creditStress';
  if (['oil','natgas','electricCost','renewableShare','spr','oilConflict','lngExport'].includes(target) || /energy/.test(cat)) return 'energySupply';
  if (['shippingCost','portEff','tariff','chinaDecoupling','nearshoring','tradeBalance','fdiInflows'].includes(target) || /trade|infra/.test(cat)) return 'supplyChain';
  if (['ffr','qePace','guidanceTone','ioer','ycc','cbIndependence'].includes(target) || /monetary/.test(cat)) return 'monetaryImpulse';
  if (['deficit','govSpend','corpTax','incomeTax','capGainsTax','infraSpend','permitSpeed','fedPermit'].includes(target) || /fiscal|state/.test(cat)) return 'fiscalImpulse';
  if (['innovRate','rdSpend','aiAdoption','vcFunding','stemGrowth','privateCapex','gridReliability'].includes(target) || /innovation|capex/.test(cat)) return 'productivity';
  if (['housingSupply','zoning','pti','vacancyRate','housingAct'].includes(target) || /housing/.test(cat)) return 'housingSupply';
  if (['unemp','lfp','highSkillImmig','skillsGap','autoDisplace','unionMem','minWage'].includes(target) || /labor/.test(cat)) return 'laborSupply';
  if (['ruleOfLaw','policyCert','electoralStab','polarization','socialCapital','regCapture'].includes(target) || /pol\. econ/.test(cat)) return 'institutional';
  if (/geopolit|global/.test(cat) || ['conflictIndex','chinaMilRisk','energyGeopolitics','cyberRisk','allyRelations'].includes(target)) return 'geopolitical';
  return 'general';
}

function defaultChannelTiming(target, type) {
  if (target === 'spA') return {lagMonths:0, peakMonth:1};
  if (target === 'cpiA') return {lagMonths:1, peakMonth:type === 'structural' ? 9 : 3};
  if (target === 'gdpA') return {lagMonths:type === 'temporary' ? 1 : 2, peakMonth:type === 'structural' ? 12 : type === 'persistent' ? 6 : 3};
  if (['ffr','qePace','oil','natgas','dxy','igSpreads','hySpreads','termPremium','foreignDemand','creditImpulse','policyCert'].includes(target)) return {lagMonths:0, peakMonth:1};
  return {lagMonths:type === 'structural' ? 2 : 1, peakMonth:type === 'structural' ? 10 : 3};
}

function enrichEventDefinition(ev) {
  const type = inferShockType(ev);
  const defaults = SHOCK_TYPE_DEFAULTS[type];
  ev.shockType = type;
  ev.durationMonths = Number.isFinite(ev.durationMonths) ? ev.durationMonths : defaults.durationMonths;
  ev.peakMonth = Number.isFinite(ev.peakMonth) ? ev.peakMonth : defaults.peakMonth;
  ev.decayRate = Number.isFinite(ev.decayRate) ? ev.decayRate : defaults.decayRate;
  ev.confidence = Number.isFinite(ev.confidence) ? ev.confidence : defaults.confidence;
  if (!Array.isArray(ev.channels)) {
    ev.channels = Object.entries(ev.d || {}).map(([target, effect]) => {
      const timing = defaultChannelTiming(target, type);
      return {target, effect:+effect, group:inferShockGroup(ev, target), ...timing};
    });
  } else {
    ev.channels = ev.channels.map(ch => ({
      group:inferShockGroup(ev, ch.target),
      ...defaultChannelTiming(ch.target, type),
      ...ch,
      effect:+ch.effect
    }));
  }
  const hasEndogenousInput = ev.channels.some(ch => !['gdpA','cpiA','spA'].includes(ch.target));
  ev.channels = ev.channels.map(ch => ({
    ...ch,
    // If a preset already changes a causal input, direct output channels are
    // interpreted as residual effects rather than counted again in full.
    residualWeight:Number.isFinite(ch.residualWeight) ? ch.residualWeight : (hasEndogenousInput && ['gdpA','cpiA','spA'].includes(ch.target) ? .65 : 1)
  }));
  return ev;
}
EVENTS.forEach(enrichEventDefinition);

function findShock(id) { return EVENTS.find(e => e.id === id); }

function defaultShockConfig(ev) {
  return {
    magnitude:1,
    onsetMonth:0,
    durationMonths:ev.durationMonths,
    peakMonth:ev.peakMonth,
    decayRate:ev.decayRate,
    shockType:ev.shockType,
    confidence:ev.confidence
  };
}

function normalizeActiveShockConfig(id, raw) {
  const ev = findShock(id);
  if (!ev) return null;
  const base = defaultShockConfig(ev);
  if (!raw || raw === true) return base;
  return {
    ...base,
    ...raw,
    magnitude:Math.max(0, Math.min(3, +(raw.magnitude ?? base.magnitude))),
    onsetMonth:Math.max(0, Math.min(60, +(raw.onsetMonth ?? base.onsetMonth))),
    durationMonths:Math.max(1, Math.min(240, +(raw.durationMonths ?? base.durationMonths))),
    peakMonth:Math.max(1, Math.min(120, +(raw.peakMonth ?? base.peakMonth))),
    decayRate:Math.max(0, Math.min(1, +(raw.decayRate ?? base.decayRate))),
    confidence:Math.max(.05, Math.min(1, +(raw.confidence ?? base.confidence)))
  };
}

function normalizeAllActiveShocks() {
  for (const id of Object.keys(activeEventIds)) {
    const cfg = normalizeActiveShockConfig(id, activeEventIds[id]);
    if (cfg) activeEventIds[id] = cfg; else delete activeEventIds[id];
  }
}

function shockPathFactor(ev, cfg, channel, month=shockProjectionMonth) {
  const start = cfg.onsetMonth + (channel.lagMonths || 0);
  const elapsed = month - start;
  if (elapsed < 0) return 0;
  const type = cfg.shockType || ev.shockType;
  const peak = Math.max(1, channel.peakMonth || cfg.peakMonth || ev.peakMonth || 1);
  const duration = Math.max(1, cfg.durationMonths || ev.durationMonths || 12);
  if (elapsed < peak) return Math.max(0, Math.min(1, (elapsed + 1) / peak));
  if (type === 'structural') return 1;
  if (type === 'persistent') {
    if (elapsed <= duration) return 1;
    return Math.exp(-(cfg.decayRate || .08) * (elapsed - duration));
  }
  if (elapsed >= duration) return 0;
  return Math.exp(-(cfg.decayRate || .28) * (elapsed - peak));
}

function shockInteraction(ev, channel, s) {
  let multiplier = 1;
  const reasons = [];
  const group = channel.group || inferShockGroup(ev, channel.target);
  if (group === 'energySupply' && channel.target === 'cpiA') {
    const labor = 1 + Math.max(0, 4.2 - s.unemp) * .07;
    const dollar = 1 + Math.max(0, 104 - s.dxy) * .008;
    multiplier *= labor * dollar;
    if (labor > 1.01) reasons.push('tight labor amplifies pass-through');
    if (dollar > 1.01) reasons.push('weaker dollar amplifies import prices');
  }
  if (group === 'fiscalImpulse' && channel.target === 'gdpA') {
    const slack = 1 + Math.max(0, s.unemp - 4.2) * .10;
    const crowd = Math.max(.62, 1 - Math.max(0, s.ffr - 3) * .055);
    multiplier *= slack * crowd;
    if (slack > 1.01) reasons.push('economic slack raises fiscal multiplier');
    if (crowd < .99) reasons.push('high rates crowd out fiscal impact');
  }
  if (group === 'creditStress' && ['gdpA','spA'].includes(channel.target)) {
    const stress = 1 + Math.max(0, s.hySpreads - 500) / 1800 + Math.max(0, s.commercialREStress - 6) * .05;
    multiplier *= Math.min(1.55, stress);
    if (stress > 1.03) reasons.push('existing credit stress amplifies losses');
  }
  if (group === 'monetaryImpulse' && channel.target === 'gdpA') {
    const seizure = s.hySpreads > 800 ? .72 : 1;
    const housing = 1 + Math.max(0, 45 - (100 - (s.pti - 3.5) * 8)) * .003;
    multiplier *= seizure * Math.min(1.18, housing);
    if (seizure < 1) reasons.push('credit seizure weakens rate transmission');
    if (housing > 1.02) reasons.push('rate-sensitive housing amplifies transmission');
  }
  if (group === 'supplyChain' && ['gdpA','cpiA'].includes(channel.target)) {
    const congestion = 1 + Math.max(0, s.shippingCost - 4) * .05 + Math.max(0, 6 - s.portEff) * .04;
    multiplier *= Math.min(1.45, congestion);
    if (congestion > 1.02) reasons.push('existing logistics stress compounds shock');
  }
  if (group === 'productivity' && channel.target === 'gdpA') {
    const capacity = Math.max(.65, Math.min(1.25, .75 + s.stemGrowth * .04 + s.gridReliability * .025));
    multiplier *= capacity;
    if (capacity < .95) reasons.push('skills/grid constraints limit productivity gains');
    if (capacity > 1.05) reasons.push('skills and grid capacity reinforce gains');
  }
  if (group === 'housingSupply' && ['gdpA','cpiA'].includes(channel.target)) {
    const shortage = 1 + Math.max(0, s.pti - 6) * .035 + Math.max(0, 6 - s.vacancyRate) * .02;
    multiplier *= Math.min(1.35, shortage);
    if (shortage > 1.03) reasons.push('housing shortage magnifies reform impact');
  }
  return {multiplier, reasons};
}

const OVERLAP_WEIGHTS = [1, .55, .30, .18, .10, .06];

function resolveActiveShocks(baseVals) {
  normalizeAllActiveShocks();
  const contributions = [];
  for (const [id, rawCfg] of Object.entries(activeEventIds)) {
    const ev = findShock(id);
    if (!ev) continue;
    const cfg = normalizeActiveShockConfig(id, rawCfg);
    for (const channel of ev.channels) {
      const timingFactor = shockPathFactor(ev, cfg, channel);
      if (timingFactor <= 0) continue;
      const interaction = shockInteraction(ev, channel, baseVals);
      const raw = channel.effect * cfg.magnitude * timingFactor * interaction.multiplier * (channel.residualWeight ?? 1);
      if (Math.abs(raw) < 1e-9) continue;
      contributions.push({
        eventId:id, eventLabel:ev.label, eventPos:ev.pos, category:ev.cat,
        shockType:cfg.shockType, confidence:cfg.confidence,
        target:channel.target, group:channel.group, baseEffect:channel.effect,
        residualWeight:channel.residualWeight ?? 1,
        timingFactor, interactionMultiplier:interaction.multiplier,
        interactionReasons:interaction.reasons, raw, adjusted:raw, overlapWeight:1
      });
    }
  }

  // Diminishing marginal effects for shocks hitting the same target and direction.
  // Opposing shocks are combined separately, so a positive offset is not unfairly
  // discounted merely because a negative shock is also active.
  const buckets = new Map();
  for (const c of contributions) {
    const key = c.target + '|' + (c.raw >= 0 ? 'pos' : 'neg');
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(c);
  }
  let rawAbsolute = 0, adjustedAbsolute = 0;
  for (const list of buckets.values()) {
    list.sort((a,b) => Math.abs(b.raw) - Math.abs(a.raw));
    list.forEach((c, i) => {
      c.overlapWeight = OVERLAP_WEIGHTS[Math.min(i, OVERLAP_WEIGHTS.length - 1)];
      c.adjusted = c.raw * c.overlapWeight;
      rawAbsolute += Math.abs(c.raw);
      adjustedAbsolute += Math.abs(c.adjusted);
    });
  }

  const effects = {};
  for (const c of contributions) effects[c.target] = (effects[c.target] || 0) + c.adjusted;
  const inputEffects = {}, outputEffects = {gdpA:0,cpiA:0,spA:0};
  for (const [target, effect] of Object.entries(effects)) {
    if (target in outputEffects) outputEffects[target] = effect;
    else inputEffects[target] = effect;
  }

  const eventSummaries = Object.keys(activeEventIds).map(id => {
    const ev = findShock(id); const cfg = normalizeActiveShockConfig(id, activeEventIds[id]);
    const parts = contributions.filter(c => c.eventId === id);
    const output = {gdpA:0,cpiA:0,spA:0};
    parts.forEach(c => { if (c.target in output) output[c.target] += c.adjusted; });
    const activeChannels = parts.length;
    const timing = activeChannels ? Math.max(...parts.map(c => c.timingFactor)) : 0;
    return {id, label:ev?.label || id, pos:ev?.pos, category:ev?.cat, config:cfg, output, activeChannels, timing};
  });

  return {
    month:shockProjectionMonth, effects, inputEffects, outputEffects, contributions, eventSummaries,
    overlapReduction:Math.max(0, rawAbsolute - adjustedAbsolute), rawAbsolute, adjustedAbsolute
  };
}

function applyShockInputEffects(s, inputEffects) {
  for (const [target, effect] of Object.entries(inputEffects)) {
    if (s[target] === undefined) continue;
    const sl = getSliderDef(target);
    let value = s[target] + effect;
    if (sl) value = Math.max(sl.min, Math.min(sl.max, value));
    s[target] = +value.toFixed(4);
  }
}

function shockTargetLabel(target) {
  return SHOCK_TARGET_LABELS[target] || getSliderDef(target)?.label || target;
}

function formatSigned(n, decimals=2, suffix='') {
  const v = Math.abs(n) < 1e-9 ? 0 : n;
  return `${v > 0 ? '+' : ''}${v.toFixed(decimals)}${suffix}`;
}

function formatShockEffect(target, value) {
  if (target === 'gdpA' || target === 'cpiA') return formatSigned(value, 2, 'pp');
  if (target === 'spA') return formatSigned(value, 1, '%');
  if (['igSpreads','hySpreads','termPremium'].includes(target)) return formatSigned(value, 0, 'bps');
  if (target === 'oil') return `${value > 0 ? '+' : ''}$${value.toFixed(0)}`;
  if (['ffr','unemp','lfp','innovRate','rdSpend','privateCapex','deficit','govSpend','tariff','housingSupply'].includes(target)) return formatSigned(value, 2);
  return formatSigned(value, Math.abs(value) >= 10 ? 0 : 2);
}

function serializeCustomEvents() {
  return EVENTS.filter(e => e.id.startsWith('custom_')).map(e => ({
    id:e.id,label:e.label,cat:e.cat,pos:e.pos,chips:e.chips,shockType:e.shockType,
    durationMonths:e.durationMonths,peakMonth:e.peakMonth,decayRate:e.decayRate,confidence:e.confidence,
    provenance:e.provenance,channels:e.channels.map(ch => ({...ch}))
  }));
}

function restoreCustomEvents(defs) {
  // A restored snapshot owns its custom definitions. Do not retain ghosts from
  // the scenario being replaced (including news assumptions removed by undo).
  const retained=EVENTS.filter(e=>!e.id.startsWith('custom_'));
  EVENTS.splice(0,EVENTS.length,...retained);
  for(const raw of Array.isArray(defs)?defs:[]) {
    if(!raw?.id || !/^custom_[a-zA-Z0-9_]+$/.test(raw.id) || findShock(raw.id))continue;
    const ev=enrichEventDefinition({...raw,channels:(raw.channels||[]).map(ch=>({...ch})),
      d:Object.fromEntries((raw.channels||[]).map(ch=>[ch.target,ch.effect]))});
    EVENTS.push(ev);
    const n=+(String(ev.id).split('_').pop())||0;
    customEventCount=Math.max(customEventCount,n);
  }
}

// ── MULTI-COUNTRY SUPPORT ─────────────────────────────────────────
let currentCountry = 'us';
let currentSection = 'overview';

const COUNTRY_CONFIGS = {
  us: {
    name:'United States', flag:'\ud83c\uddfa\ud83c\uddf8', emoji:'US', currency:'USD',
    gdpSize:'$28T', color:'#4a9eff',
    description:'World largest economy. Reserve currency issuer. Deep capital markets, high innovation, structural fiscal deficit.',
    neutralFFR:3.5, debtToGDP:1.22, gdpBase:2.5, cpiBase:2.5, tenyrBase:4.2, mortgBase:6.9,
    defaults:{},
    labelMap:{ ffr:'Fed Funds Rate', cbIndependence:'Fed Independence', dxy:'DXY Dollar Index', lngExport:'LNG Export Capacity' },
    adj:{ mon:1.00, fis:1.00, tax:1.00, innov:1.00, capex:1.00, polEcon:1.00, trade:1.00, labor:1.00, dxyLag:1.00 },
    baselines:{ gdp:2.5, cpi:2.5, tenyr:4.2, mortg:6.9, housingAff:50, sp500:100, conf:55, defAdj:6.5, dollarAdj:104, fsi:80, twoyr:4.8, yldSprd:-0.6, tfp:1.2, interestCostPctGDP:3.5, rowGrowth:2.8 },
    q2:{ gdp:2.1, cpi:3.0, ffr:4.25, tenyr:4.35, unemp:4.2, oil:69, dxy:103, housing:1.35, natgas:3.2, mortg:6.75 }
  },
  eu: {
    name:'Eurozone', flag:'\ud83c\uddea\ud83c\uddfa', emoji:'EU', currency:'EUR',
    gdpSize:'\u20ac15T', color:'#00d47a',
    description:'Currency union without fiscal union. High trade openness (45% of GDP). Energy import-dependent. ECB independent but politically constrained.',
    neutralFFR:2.5, debtToGDP:0.92, gdpBase:1.2, cpiBase:2.2, tenyrBase:2.8, mortgBase:4.0,
    defaults:{ ffr:3.25, qePace:-10, deficit:3.5, corpTax:22, incomeTax:48, govSpend:2.5,
               regBurden:8, unemp:6.0, unionMem:22, tariff:5, renewableShare:40,
               lngExport:2, oil:80, natgas:12, carbonPolicy:7, innovRate:1.2, aiAdoption:5,
               housingSupply:1.0, zoning:8, polarization:7, cbIndependence:8,
               stressTest:8, chinaDecoupling:5, privateCapex:15, shippingCost:5,
               energyGeopolitics:7, electricCost:7, ioer:3.15 },
    labelMap:{ ffr:'ECB Deposit Rate', cbIndependence:'ECB Independence', dxy:'EUR Strength (trade-wtd)', lngExport:'LNG Import Dependence', warshrules:'Rules-Based ECB Adherence' },
    adj:{ mon:0.78, fis:0.90, tax:1.15, innov:0.82, capex:0.88, polEcon:1.25, trade:1.45, labor:0.85, dxyLag:0.65 },
    baselines:{ gdp:1.2, cpi:2.2, tenyr:2.8, mortg:4.0, housingAff:42, sp500:100, conf:48, defAdj:3.5, dollarAdj:104, fsi:75, twoyr:3.0, yldSprd:-0.2, tfp:0.9, interestCostPctGDP:2.5, rowGrowth:2.8 },
    q2:{ gdp:1.0, cpi:2.3, ffr:3.25, tenyr:2.85, unemp:5.9, oil:80, dxy:1.08, housing:1.0, natgas:12, mortg:4.4 }
  },
  cn: {
    name:'China', flag:'\ud83c\udde8\ud83c\uddf3', emoji:'CN', currency:'CNY',
    gdpSize:'$18T', color:'#ff4055',
    description:'State-directed investment-led growth model. Property sector stress (25% of activity). Tech decoupling from West. Demographic headwinds.',
    neutralFFR:3.0, debtToGDP:0.87, gdpBase:4.5, cpiBase:1.8, tenyrBase:2.4, mortgBase:4.0,
    defaults:{ ffr:3.1, qePace:20, deficit:7.0, corpTax:25, incomeTax:45, govSpend:6,
               regBurden:7, unemp:5.5, unionMem:8, tariff:8, oil:85, natgas:6,
               innovRate:1.8, rdSpend:2.4, aiAdoption:7, vcFunding:120,
               housingSupply:2.8, privateCapex:22, commercialREStress:8, pti:8, zoning:5,
               cbIndependence:3, ruleOfLaw:4, govEffective:7, polarization:2,
               policyCert:6, electoralStab:8, chinaDecoupling:7, termPremium:10,
               foreignDemand:5, renewableShare:35, lngExport:3, creditImpulse:-1,
               socialCapital:6, regCapture:6, mediaQuality:3, ioer:3.0 },
    labelMap:{ ffr:'PBoC LPR (1yr)', cbIndependence:'PBoC Independence', dxy:'USD/CNY Strength', warshrules:'PBoC Rules-Based Adherence', lngExport:'LNG Export Capacity' },
    adj:{ mon:0.62, fis:1.55, tax:0.72, innov:1.25, capex:1.85, polEcon:0.52, trade:1.65, labor:0.80, dxyLag:0.90 },
    baselines:{ gdp:4.5, cpi:1.8, tenyr:2.4, mortg:4.0, housingAff:38, sp500:100, conf:52, defAdj:7.0, dollarAdj:104, fsi:65, twoyr:2.2, yldSprd:0.2, tfp:1.5, interestCostPctGDP:2.0, rowGrowth:2.8 },
    q2:{ gdp:4.2, cpi:1.5, ffr:3.1, tenyr:2.4, unemp:5.5, oil:85, dxy:7.25, housing:null, natgas:6, mortg:3.9 }
  },
  uk: {
    name:'United Kingdom', flag:'\ud83c\uddec\ud83c\udde7', emoji:'UK', currency:'GBP',
    gdpSize:'\u00a32.3T', color:'#ffd44a',
    description:'Post-Brexit adjustment. Extremely supply-constrained housing (green belt). Services-dominated (80% of GDP). BoE independence intact.',
    neutralFFR:3.0, debtToGDP:1.00, gdpBase:1.0, cpiBase:2.8, tenyrBase:4.4, mortgBase:5.5,
    defaults:{ ffr:4.75, qePace:-15, deficit:4.5, corpTax:25, incomeTax:45, govSpend:2,
               regBurden:6, unemp:4.5, unionMem:22, tariff:8, housingSupply:0.5,
               zoning:9, oil:75, natgas:10, innovRate:1.3, rdSpend:2.8, aiAdoption:6,
               polarization:7, cbIndependence:8, chinaDecoupling:7,
               renewableShare:35, lngExport:4, privateCapex:15, pti:9,
               fedLandPermit:6, permitSpeed:4, electricCost:7, ioer:4.65 },
    labelMap:{ ffr:'BoE Bank Rate', cbIndependence:'BoE Independence', dxy:'GBP Trade-Wtd Strength', fedPermit:'UK Planning Permission Speed', fedLandPermit:'Greenbelt Reform Progress' },
    adj:{ mon:1.02, fis:0.78, tax:1.08, innov:0.90, capex:0.88, polEcon:1.12, trade:1.52, labor:0.95, dxyLag:0.72 },
    baselines:{ gdp:1.0, cpi:2.8, tenyr:4.4, mortg:5.5, housingAff:32, sp500:100, conf:46, defAdj:4.5, dollarAdj:104, fsi:72, twoyr:4.5, yldSprd:-0.1, tfp:0.9, interestCostPctGDP:3.0, rowGrowth:2.8 },
    q2:{ gdp:0.9, cpi:2.8, ffr:4.75, tenyr:4.5, unemp:4.4, oil:75, dxy:1.27, housing:0.5, natgas:10, mortg:5.4 }
  },
  jp: {
    name:'Japan', flag:'\ud83c\uddef\ud83c\uddf5', emoji:'JP', currency:'JPY',
    gdpSize:'\u00a5600T', color:'#f0a030',
    description:'ZLB trap, demographics dominate. Debt/GDP 260%. YCC partially unwound 2024. Yen carry trade systemic risk. Innovation lag vs. 1980s peak.',
    neutralFFR:0.25, debtToGDP:2.60, gdpBase:1.0, cpiBase:2.0, tenyrBase:1.5, mortgBase:2.0,
    defaults:{ ffr:0.5, qePace:15, deficit:7.5, corpTax:30, incomeTax:55, govSpend:3,
               ycc:5, termPremium:-30, regBurden:7, unemp:2.6, lfp:63, unionMem:17,
               oil:85, natgas:15, innovRate:1.0, rdSpend:3.3, aiAdoption:4,
               housingSupply:0.8, renewableShare:22, tariff:5, privateCapex:16,
               socialCapital:8, polarization:3, cbIndependence:6, ruleOfLaw:8,
               govEffective:6, foreignDemand:9, chinaDecoupling:6,
               electricCost:6, energyGeopolitics:6, ioer:0.4 },
    labelMap:{ ffr:'BoJ Policy Rate', cbIndependence:'BoJ Independence', ycc:'YCC Cap Intensity', dxy:'USD/JPY Sensitivity', warshrules:'BoJ Rules-Based Adherence' },
    adj:{ mon:0.22, fis:0.60, tax:0.80, innov:0.88, capex:0.72, polEcon:0.90, trade:1.22, labor:0.60, dxyLag:1.20 },
    baselines:{ gdp:1.0, cpi:2.0, tenyr:1.5, mortg:2.0, housingAff:55, sp500:100, conf:44, defAdj:7.5, dollarAdj:104, fsi:70, twoyr:0.8, yldSprd:0.7, tfp:0.8, interestCostPctGDP:5.5, rowGrowth:2.8 },
    q2:{ gdp:0.8, cpi:2.0, ffr:0.5, tenyr:1.5, unemp:2.5, oil:85, dxy:150, housing:0.8, natgas:15, mortg:2.0 }
  },
  em: {
    name:'Emerging Markets', flag:'\ud83c\udf10', emoji:'EM', currency:'USD-linked',
    gdpSize:'~$25T', color:'#4a9eff',
    description:'Composite: India, Brazil, Mexico, Indonesia. Dollar-sensitive debt. Commodity cycle driven. Demographics positive but institutional gaps.',
    neutralFFR:5.0, debtToGDP:0.65, gdpBase:4.0, cpiBase:4.5, tenyrBase:8.0, mortgBase:12.0,
    defaults:{ ffr:6.5, qePace:0, deficit:5.0, corpTax:28, incomeTax:40, govSpend:3,
               regBurden:7, unemp:7.0, lfp:60, unionMem:18, tariff:12, oil:80,
               natgas:8, innovRate:0.8, rdSpend:1.2, aiAdoption:4, vcFunding:80,
               housingSupply:1.0, zoning:6, privateCapex:15, ruleOfLaw:5,
               govEffective:5, socialCapital:5, polarization:7, cbIndependence:5,
               electoralStab:5, regCapture:7, dollarReserve:4, conflictIndex:6,
               foreignDemand:5, termPremium:80, chinaDecoupling:5, creditImpulse:0 },
    labelMap:{ ffr:'EM Avg. Policy Rate', cbIndependence:'EM CB Independence', dxy:'DXY (inverse driver)', warshrules:'CB Rules Adherence' },
    adj:{ mon:1.30, fis:1.22, tax:0.70, innov:0.52, capex:1.42, polEcon:2.02, trade:1.52, labor:1.12, dxyLag:1.80 },
    baselines:{ gdp:4.0, cpi:4.5, tenyr:8.0, mortg:12.0, housingAff:35, sp500:100, conf:50, defAdj:5.0, dollarAdj:104, fsi:60, twoyr:7.5, yldSprd:0.5, tfp:1.0, interestCostPctGDP:2.8, rowGrowth:2.8 },
    q2:{ gdp:3.8, cpi:4.5, ffr:6.5, tenyr:8.0, unemp:7.0, oil:80, dxy:103, housing:null, natgas:8, mortg:12 }
  }
};

function getCountryLabel(id) {
  const cc = COUNTRY_CONFIGS[currentCountry];
  return (cc && cc.labelMap && cc.labelMap[id]) ? cc.labelMap[id] : null;
}

function getCountryAdjustments(country) {
  return (COUNTRY_CONFIGS[country] || COUNTRY_CONFIGS.us).adj;
}

function switchCountry(id) {
  if (!COUNTRY_CONFIGS[id]) return;
  currentCountry = id;
  overviewReference = null;
  const cc = COUNTRY_CONFIGS[id];

  // Update flag display
  const flagEl = document.getElementById('country-flag');
  if (flagEl) flagEl.textContent = cc.flag;
  document.getElementById('country-select').value = id;

  // Apply country defaults over global DEFAULTS. Official synchronization is U.S.-only.
  officialSyncEnabled = false; officialBaselineVals = null; officialCalibration = {gdp:0,cpi:0,tenyr:0,twoyr:0,mortg:0};
  vals = Object.assign({}, DEFAULTS, cc.defaults);
  activeEventIds = {};
  selectedShockId = null;
  shockProjectionMonth = 3;

  // Update BASELINES to country's baselines
  Object.assign(BASELINES, COUNTRY_CONFIGS.us.baselines); // reset
  Object.assign(BASELINES, cc.baselines);                 // apply country

  // Rebuild content (updates labels + slider positions)
  buildContent();

  if (id === 'us' && officialData) applyOfficialBaseline({silent:true, skipRebuild:true, force:true});

  // Restore section
  const btn = Array.from(document.querySelectorAll('.nav-item'))
    .find(b => b.getAttribute('onclick') && b.getAttribute('onclick').includes("'" + currentSection + "'"));
  showSection(currentSection, btn || null);

  // Clear events
  document.querySelectorAll('.ev-card').forEach(c => c.classList.remove('active'));
  renderEventLog();
  render();
  commitChange();

  // Country description toast
  const toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;bottom:52px;left:50%;transform:translateX(-50%);background:var(--surface2);border:1px solid var(--border2);border-radius:var(--r-lg);padding:10px 18px;font-size:12px;color:var(--text-dim);z-index:999;max-width:480px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.5);';
  toast.innerHTML = '<strong style="color:var(--text)">' + cc.flag + ' ' + cc.name + '</strong> &mdash; ' + cc.description;
  document.body.appendChild(toast);
  setTimeout(() => toast.style.transition='opacity 0.4s', 2200);
  setTimeout(() => { toast.style.opacity='0'; setTimeout(()=>toast.remove(),400); }, 2600);
}

// Country-specific comparison runner
function runCountryComparison() {
  const savedVals = Object.assign({}, vals);
  const savedCountry = currentCountry;
  const savedTR = taylorRuleOn;
  taylorRuleOn = false;

  const rows = [];
  for (const [id, cc] of Object.entries(COUNTRY_CONFIGS)) {
    currentCountry = id;
    Object.assign(BASELINES, cc.baselines);
    vals = Object.assign({}, DEFAULTS, cc.defaults);
    const m = compute();
    rows.push({ id, cc, m });
  }

  // Restore
  currentCountry = savedCountry;
  vals = savedVals;
  taylorRuleOn = savedTR;
  Object.assign(BASELINES, COUNTRY_CONFIGS[savedCountry].baselines);

  return rows;
}

function renderCountryComparison() {
  const panel = document.getElementById('cc-table-wrap');
  if (!panel) return;
  panel.innerHTML = '<div style="color:var(--muted);font-family:var(--font-mono);font-size:11px">Running comparison\u2026</div>';

  // Defer so UI updates
  setTimeout(() => {
    const rows = runCountryComparison();

    const cols = [
      { lbl:'GDP\u00a0%',    fn: m => m.gdp.toFixed(1)+'%',  dir:1,  thresh:[0,1.5] },
      { lbl:'CPI\u00a0%',    fn: m => m.cpi.toFixed(1)+'%',  dir:-1, thresh:[3.5,6] },
      { lbl:'10yr Yld',  fn: m => m.tenyr.toFixed(2)+'%',dir:-1, thresh:[5,7] },
      { lbl:'Mortgage',  fn: m => m.mortg.toFixed(2)+'%',dir:-1, thresh:[6,9] },
      { lbl:'Hsg Aff.',  fn: m => Math.round(m.housingAff)+'/100', dir:1, thresh:[40,25] },
      { lbl:'FSI',       fn: m => Math.round(m.fsi)+'/100',  dir:1,  thresh:[70,50] },
      { lbl:'Deficit%',  fn: m => m.defAdj.toFixed(1)+'%',   dir:-1, thresh:[5,8] },
      { lbl:'Debt Svc%', fn: m => m.interestCostPctGDP.toFixed(1)+'%', dir:-1, thresh:[3.5,5] },
      { lbl:'TFP%',      fn: m => m.tfp.toFixed(2)+'%',      dir:1,  thresh:[1.0,0.5] },
    ];

    const ths = '<th>Economy</th>' + cols.map(c => '<th>' + c.lbl + '</th>').join('');

    const trs = rows.map(({ id, cc, m }) => {
      const isCurrent = id === currentCountry;
      const tds = cols.map(c => {
        const raw = parseFloat(c.fn(m));
        let cls = '';
        if (c.dir === 1) {
          cls = raw < c.thresh[1] ? 'cc-val-bad' : raw < c.thresh[0] ? 'cc-val-warn' : 'cc-val-good';
        } else {
          cls = raw > c.thresh[1] ? 'cc-val-bad' : raw > c.thresh[0] ? 'cc-val-warn' : 'cc-val-good';
        }
        return '<td class="' + cls + '">' + c.fn(m) + '</td>';
      }).join('');
      const flag = cc.flag;
      return '<tr class="' + (isCurrent ? 'cc-current' : '') + '"><td>' + flag + ' ' + cc.name + '</td>' + tds + '</tr>';
    }).join('');

    panel.innerHTML = '<table class="cc-table"><thead><tr>' + ths + '</tr></thead><tbody>' + trs + '</tbody></table>';
  }, 30);
}

// ── TAYLOR RULE ────────────────────────────────────────────────────
let taylorRuleOn = false;

function syncTaylorRuleUi() {
  const btn = document.getElementById('tr-toggle');
  if (btn) {
    btn.textContent = taylorRuleOn ? 'TAYLOR ON' : 'TAYLOR OFF';
    btn.classList.toggle('on', taylorRuleOn);
  }
  const ffrCard = document.getElementById('r-ffr');
  if (ffrCard && ffrCard.closest('.slider-card')) ffrCard.closest('.slider-card').classList.toggle('tr-active', taylorRuleOn);
}

function toggleTaylorRule() {
  taylorRuleOn = !taylorRuleOn;
  syncTaylorRuleUi();
  render();
  commitChange();
}

// ── MONTE CARLO ─────────────────────────────────────────────────────
function randNormal() {
  const u1 = Math.max(1e-10, Math.random());
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * Math.random());
}

const MC_PARAMS = [
  { key:'oil',          sigma:14   },
  { key:'deficit',      sigma:1.5  },
  { key:'innovRate',    sigma:0.40 },
  { key:'policyCert',   sigma:1.4  },
  { key:'foreignDemand',sigma:1.3  },
  { key:'hySpreads',    sigma:115  },
  { key:'conflictIndex',sigma:1.1  },
  { key:'ffr',          sigma:0.45 },
];

function runMonteCarlo(nSims) {
  nSims = nSims || 220;
  const saved = Object.assign({}, vals);
  const savedTR = taylorRuleOn;
  taylorRuleOn = false;
  const results = [];
  for (let i = 0; i < nSims; i++) {
    for (const u of MC_PARAMS) {
      const def = getSliderDef(u.key);
      if (!def) continue;
      vals[u.key] = Math.max(def.min, Math.min(def.max, saved[u.key] + randNormal() * u.sigma));
    }
    results.push(compute().gdp);
  }
  Object.assign(vals, saved);
  taylorRuleOn = savedTR;
  results.sort((a, b) => a - b);
  const p = (pct) => results[Math.max(0, Math.min(nSims-1, Math.floor(nSims * pct)))];
  return { p10:p(0.10), p25:p(0.25), p50:p(0.50), p75:p(0.75), p90:p(0.90) };
}

// ── HISTORICAL PRESETS ──────────────────────────────────────────────
const HISTORICAL_PRESETS = {
  gfc2008: {
    name:'2008 Global Financial Crisis', period:'Sep 2008\u2013Mar 2009', type:'recession',
    desc:'Lehman collapse triggered the worst financial crisis since 1929. Housing implosion, credit seizure, and global demand collapse.',
    stats:[{t:'GDP \u22124.3%',c:'neg'},{t:'Unemp 10%',c:'neg'},{t:'HY 1750bps',c:'neg'},{t:'S&P \u221257%',c:'neg'}],
    vals:{ ffr:1.0, qePace:80, deficit:9.8, govSpend:8, unemp:9.5, lfp:64.5, oil:55,
           housingSupply:0.7, hySpreads:1750, igSpreads:450, foreignDemand:8,
           commercialREStress:9, pti:9.0, privateCapex:12, policyCert:2,
           polarization:6, ruleOfLaw:7, creditImpulse:-4.5, termPremium:-20 }
  },
  covid2020: {
    name:'2020 COVID-19 Shock', period:'Q2 2020 (Apr\u2013Jun)', type:'crisis',
    desc:'Fastest GDP contraction in US history \u2014 pandemic supply+demand shock met with unprecedented fiscal and monetary response.',
    stats:[{t:'GDP \u221231%',c:'neg'},{t:'Unemp 14.7%',c:'neg'},{t:'Deficit +17%',c:'neg'},{t:'QE +$3T',c:'neu'}],
    vals:{ ffr:0.25, qePace:120, deficit:17, govSpend:14, unemp:13, oil:35,
           hySpreads:800, igSpreads:350, privateCapex:12, shippingCost:8,
           housingSupply:0.9, creditImpulse:-3.0, polarization:7, policyCert:3,
           foreignDemand:8 }
  },
  volcker1981: {
    name:'1979\u201382 Volcker Disinflation', period:'1981 Peak Tightening', type:'recession',
    desc:'Paul Volcker broke 1970s inflation with rates above 20%. Two recessions and mass unemployment \u2014 but lasting price stability.',
    stats:[{t:'FFR 20%+',c:'neg'},{t:'CPI 13%',c:'neg'},{t:'Unemp 10.8%',c:'neg'},{t:'Long-run win',c:'pos'}],
    vals:{ ffr:10, deficit:4.0, unemp:10.5, oil:95, govSpend:3, hySpreads:700,
           igSpreads:250, guidanceTone:9, warshrules:9, foreignDemand:6,
           privateCapex:14, polarization:5, innovRate:1.0, creditImpulse:-3.0,
           termPremium:150, oilConflict:8, energyGeopolitics:8 }
  },
  goldilocks1998: {
    name:'1995\u20132000 Goldilocks Boom', period:'Late Clinton Expansion', type:'boom',
    desc:'Balanced federal budget, internet-driven TFP boom, near-full employment, benign inflation. Longest US expansion on record at the time.',
    stats:[{t:'GDP 4.5%',c:'pos'},{t:'Unemp 4.0%',c:'pos'},{t:'Budget surplus',c:'pos'},{t:'TFP +2.1%',c:'pos'}],
    vals:{ ffr:5.25, deficit:-0.5, unemp:4.0, oil:25, govSpend:1, housingSupply:1.8,
           innovRate:2.2, rdSpend:2.5, aiAdoption:2, vcFunding:100, patentRate:7,
           policyCert:8, polarization:4, ruleOfLaw:9, creditImpulse:2.0,
           socialCapital:7, cbIndependence:9, privateCapex:19 }
  },

  eu_sovereign_2012: {
    name:'2010\u201312 Eurozone Debt Crisis', period:'Jun 2012 Peak', type:'recession',
    desc:'Greek, Irish, Portuguese, Spanish and Italian sovereign spreads blew out. ECB "whatever it takes" ultimately resolved it but at enormous austerity cost.',
    stats:[{t:'GDP -0.6%',c:'neg'},{t:'BTP/Bund 500bps',c:'neg'},{t:'Unemp 12%',c:'neg'},{t:'ECB rescue',c:'neu'}],
    vals:{ ffr:0.75, deficit:6.5, unemp:11, hySpreads:800, igSpreads:400, foreignDemand:4,
           govSpend:-2, pti:10, commercialREStress:9, creditImpulse:-3, polarization:8,
           cbIndependence:7, ruleOfLaw:6, policyCert:2, termPremium:100 }
  },
  eu_energy_2022: {
    name:'2022 EU Energy Crisis', period:'Aug\u2013Dec 2022', type:'crisis',
    desc:'Russian gas cutoff after Ukraine invasion. European natural gas surged 10x. Deindustrialisation risk, emergency price caps, demand destruction.',
    stats:[{t:'Gas +900%',c:'neg'},{t:'CPI 10%+',c:'neg'},{t:'GDP -0.5%',c:'neg'},{t:'Emergency caps',c:'neu'}],
    vals:{ natgas:18, oil:110, oilConflict:9, energyGeopolitics:9, deficit:5, govSpend:5,
           electricCost:10, lngExport:2, renewableShare:38, hySpreads:500, creditImpulse:-1.5,
           conflictIndex:8, chinaDecoupling:5 }
  },
  cn_stock_crash_2015: {
    name:'2015\u201316 China Growth Scare', period:'Aug 2015 Crash', type:'crisis',
    desc:'China stock market lost 40%. Capital outflows, yuan devaluation fears, manufacturing PMI collapse. Global risk-off contagion.',
    stats:[{t:'S&P -12%',c:'neg'},{t:'Yuan -4%',c:'neg'},{t:'FDI \u221215%',c:'neg'},{t:'PBoC cuts',c:'neu'}],
    vals:{ ffr:2.5, hySpreads:600, igSpreads:250, creditImpulse:-3, chinaDecoupling:5,
           commercialREStress:7, govSpend:4, qePace:30, unemp:6, pti:7, polarization:3,
           cbIndependence:3, ruleOfLaw:4 }
  },
  uk_truss_2022: {
    name:'2022 UK Mini-Budget Crisis', period:'Sep\u2013Oct 2022', type:'crisis',
    desc:'Kwasi Kwarteng\u2019s unfunded \u00a345B tax cut triggered gilt crisis. BoE emergency intervention. PM Truss resigned in 45 days. Institutional credibility hit.',
    stats:[{t:'Gilt yield +150bps',c:'neg'},{t:'GBP -8%',c:'neg'},{t:'BoE QE emergency',c:'neg'},{t:'PM resigned',c:'neg'}],
    vals:{ ffr:3.5, deficit:7, corpTax:19, foreignDemand:3, termPremium:80, hySpreads:500,
           govSpend:5, cbIndependence:5, ruleOfLaw:6, policyCert:2, polarization:8,
           creditImpulse:-1.5, electoralStab:4 }
  },
  jp_bubble_1990: {
    name:'1990 Japan Bubble Collapse', period:'1990\u201393 Unwinding', type:'recession',
    desc:'BoJ overtightening burst the Nikkei and land price bubble. \u201CLost Decade\u201D began. Banks insolvent, deflation trap, policy paralysis.',
    stats:[{t:'Nikkei -48%',c:'neg'},{t:'Land -50%',c:'neg'},{t:'GDP \u22122%',c:'neg'},{t:'30yr stagnation',c:'neg'}],
    vals:{ ffr:6, deficit:3, unemp:4, hySpreads:300, igSpreads:150, commercialREStress:10,
           pti:14, housingSupply:0.6, creditImpulse:-4, cbIndependence:5, innovRate:1.5,
           privateCapex:18, socialCapital:8, ycc:0, termPremium:50 }
  },
  em_taper_tantrum_2013: {
    name:'2013 Taper Tantrum (EM)', period:'May\u2013Sep 2013', type:'crisis',
    desc:'Bernanke hint at QE tapering triggered massive EM capital outflows. \u201CFragile Five\u201D currencies collapsed. Commodity exporters hit hardest.',
    stats:[{t:'EM FX \u221215%',c:'neg'},{t:'FDI \u221220%',c:'neg'},{t:'HY +300bps',c:'neg'},{t:'Reserves fell',c:'neg'}],
    vals:{ ffr:0.25, qePace:-10, hySpreads:650, igSpreads:300, foreignDemand:4,
           fdiInflows:3, dollarReserve:4, termPremium:60, creditImpulse:-2.5,
           oil:90, commoditySupercycle:0, chinaDecoupling:3, unemp:8, conflictIndex:6 }
  },
  stagflation1974: {
    name:'1974\u201375 Stagflation', period:'Oil Shock Recession', type:'crisis',
    desc:'OPEC oil embargo triggered simultaneous high inflation + recession, invalidating the Phillips Curve. Classic supply-side stagflation.',
    stats:[{t:'CPI 12%',c:'neg'},{t:'Unemp 9%',c:'neg'},{t:'Oil +400%',c:'neg'},{t:'GDP \u22123.1%',c:'neg'}],
    vals:{ ffr:7.5, oil:95, deficit:4.5, unemp:8.5, govSpend:3, hySpreads:600,
           igSpreads:280, innovRate:0.8, privateCapex:13, oilConflict:9,
           energyGeopolitics:9, lngExport:1, spr:20, creditImpulse:-2.0,
           polarization:6, policyCert:3 }
  }
};

function loadHistoricalPreset(id) {
  const preset = HISTORICAL_PRESETS[id];
  if (!preset) return;
  // Reset to defaults first, then overlay preset values
  vals = Object.assign({}, DEFAULTS, preset.vals);
  activeEventIds = {};
  selectedShockId = null;
  shockProjectionMonth = 3;
  // Update all slider UI
  for (const cat of CATEGORIES) {
    for (const sl of cat.sliders) {
      const el = document.getElementById('r-' + sl.id);
      const vEl = document.getElementById('v-' + sl.id);
      if (el) el.value = vals[sl.id];
      if (vEl) vEl.textContent = sl.fmt(vals[sl.id]);
    }
  }
  document.querySelectorAll('.ev-card').forEach(c => c.classList.remove('active'));
  refreshAllModified();
  render();
  renderEventLog();
  document.getElementById('sc-name').value = preset.name;
  // Switch to monetary view to show the changes
  const monBtn = Array.from(document.querySelectorAll('.nav-item')).find(b => b.textContent.trim().startsWith('Monetary'));
  if (monBtn) showSection('monetary', monBtn);
  commitChange();
}

// ── TIME HORIZON & ANALYSIS WEIGHTS ─────────────────────────────
// Controls which factors dominate across short/medium/long run.
// Empirical basis: cyclical factors (monetary, fiscal stimulus) mean-revert
// within 1-3yr; structural factors (TFP, institutions, infrastructure) compound
// over decades and are wildly underweighted in 1yr forecast models.
let timeHorizon = 1;

const HZ_HINTS = {
  1:  'Cyclical: monetary & demand factors dominate',
  3:  'Structural: CAPEX, reform & trade fully transmit',
  10: 'Fundamental: TFP, institutions & demographics rule'
};

function setHorizon(h) {
  timeHorizon = h;
  overviewReference = null;
  [1, 3, 10].forEach(x => {
    const b = document.getElementById('hz-' + x);
    if (b) b.classList.toggle('active', x === h);
  });
  const hint = document.getElementById('hz-hint');
  if (hint) hint.textContent = HZ_HINTS[h] || '';
  render();
  if (chartsVisible) renderCharts(compute());
  commitChange();
}

function getHorizonWeights(h) {
  // Each weight multiplies the GDP sensitivity coefficient for that category.
  // mon:     monetary policy (mean-reverts; Fed responds over time)
  // fis:     fiscal spending multiplier (decays as crowding-out builds)
  // tax:     tax/regulatory reform (capital allocation shift takes years)
  // innov:   innovation/TFP (slow diffusion but enormous compounding)
  // capex:   private investment & infrastructure (builds productive capacity)
  // polEcon: institutional quality (invisible short-term, decisive long-term)
  // trade:   tariff/FX transmission (hits fast, partially re-routes over time)
  // labor:   unemployment slack (purely cyclical)
  // dxyLag:  DXY→CPI passthrough lag (6-18mo for import prices to adjust)
  //          [dollar lag improvement] only 55% passes through in year 1
  if (h === 1)  return { mon:1.00, fis:1.00, tax:0.40, innov:0.28, capex:0.38, polEcon:0.28, trade:0.85, labor:1.00, dxyLag:0.55 };
  if (h === 3)  return { mon:0.55, fis:0.75, tax:0.85, innov:1.00, capex:1.00, polEcon:0.88, trade:1.00, labor:0.88, dxyLag:0.82 };
  if (h === 10) return { mon:0.08, fis:0.28, tax:1.30, innov:2.20, capex:1.65, polEcon:2.10, trade:0.65, labor:0.65, dxyLag:1.00 };
  return        { mon:1.00, fis:1.00, tax:1.00, innov:1.00, capex:1.00, polEcon:1.00, trade:1.00, labor:1.00, dxyLag:1.00 };
}

