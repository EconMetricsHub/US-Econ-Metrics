// MACROSCOPE Live Data Gateway
//
// The Worker owns upstream credentials and automatic refresh. The browser reads
// only verified observations from this gateway. FRED's authenticated API is the
// primary source when FRED_API_KEY is configured; the public FRED graph CSV is
// a keyless fallback so a missing/rotated key does not make the simulator unusable.

export const DATA_SERIES = {
  headline_cpi: {
    calendarKey:'headlineCpiYoy', label:'Headline CPI inflation', seriesId:'CPIAUCSL', unitsParam:'pc1', units:'%', precision:2,
    category:'Inflation', outputTarget:'cpi', sourceAgency:'U.S. Bureau of Labor Statistics', frequency:'Monthly', staleAfterDays:75,
    description:'Consumer Price Index for All Urban Consumers, percent change from a year ago.'
  },
  core_cpi: {
    calendarKey:'coreCpiYoy', label:'Core CPI inflation', seriesId:'CPILFESL', unitsParam:'pc1', units:'%', precision:2,
    category:'Inflation', sourceAgency:'U.S. Bureau of Labor Statistics', frequency:'Monthly', staleAfterDays:75,
    description:'CPI excluding food and energy, percent change from a year ago.'
  },
  pce_inflation: {
    calendarKey:'pceInflationYoy', label:'PCE inflation', seriesId:'PCEPI', unitsParam:'pc1', units:'%', precision:2,
    category:'Inflation', sourceAgency:'U.S. Bureau of Economic Analysis', frequency:'Monthly', staleAfterDays:75,
    description:'Personal Consumption Expenditures price index, percent change from a year ago.'
  },
  unemployment: {
    calendarKey:'unemployment', label:'Unemployment rate', seriesId:'UNRATE', unitsParam:'lin', units:'%', precision:1,
    category:'Labor', inputTarget:'unemp', sourceAgency:'U.S. Bureau of Labor Statistics', frequency:'Monthly', staleAfterDays:75,
    description:'Civilian unemployment rate.'
  },
  labor_force_participation: {
    calendarKey:'laborForceParticipation', label:'Labor-force participation', seriesId:'CIVPART', unitsParam:'lin', units:'%', precision:1,
    category:'Labor', inputTarget:'lfp', sourceAgency:'U.S. Bureau of Labor Statistics', frequency:'Monthly', staleAfterDays:75,
    description:'Civilian labor-force participation rate.'
  },
  payroll_change: {
    calendarKey:'payrollChange', label:'Monthly payroll change', seriesId:'PAYEMS', unitsParam:'chg', units:'K', precision:0,
    category:'Labor', sourceAgency:'U.S. Bureau of Labor Statistics', frequency:'Monthly', staleAfterDays:75,
    description:'Change in total nonfarm payroll employment, thousands of jobs.'
  },
  real_gdp_growth: {
    calendarKey:'realGdpGrowth', label:'Real GDP growth', seriesId:'A191RL1Q225SBEA', unitsParam:'lin', units:'%', precision:1,
    category:'Growth', outputTarget:'gdp', sourceAgency:'U.S. Bureau of Economic Analysis', frequency:'Quarterly', staleAfterDays:160,
    description:'Real GDP percent change from preceding period at a seasonally adjusted annual rate.'
  },
  fed_funds: {
    calendarKey:'effectiveFedFunds', label:'Effective federal funds rate', seriesId:'DFF', unitsParam:'lin', units:'%', precision:2,
    category:'Rates', inputTarget:'ffr', sourceAgency:'Board of Governors of the Federal Reserve System', frequency:'Daily', staleAfterDays:8,
    description:'Effective federal funds rate.'
  },
  iorb: {
    calendarKey:'interestOnReserveBalances', label:'Interest on reserve balances', seriesId:'IORB', unitsParam:'lin', units:'%', precision:2,
    category:'Rates', inputTarget:'ioer', sourceAgency:'Board of Governors of the Federal Reserve System', frequency:'Daily', staleAfterDays:8,
    description:'Interest rate paid on reserve balances.'
  },
  two_year_treasury: {
    calendarKey:'treasury2Year', label:'2-year Treasury yield', seriesId:'DGS2', unitsParam:'lin', units:'%', precision:2,
    category:'Rates', outputTarget:'twoyr', sourceAgency:'Board of Governors of the Federal Reserve System / U.S. Treasury', frequency:'Daily', staleAfterDays:8,
    description:'Market yield on U.S. Treasury securities at 2-year constant maturity.'
  },
  ten_year_treasury: {
    calendarKey:'treasury10Year', label:'10-year Treasury yield', seriesId:'DGS10', unitsParam:'lin', units:'%', precision:2,
    category:'Rates', outputTarget:'tenyr', sourceAgency:'Board of Governors of the Federal Reserve System / U.S. Treasury', frequency:'Daily', staleAfterDays:8,
    description:'Market yield on U.S. Treasury securities at 10-year constant maturity.'
  },
  mortgage_30y: {
    calendarKey:'mortgage30Year', label:'30-year mortgage rate', seriesId:'MORTGAGE30US', unitsParam:'lin', units:'%', precision:2,
    category:'Housing', outputTarget:'mortg', sourceAgency:'Freddie Mac', frequency:'Weekly', staleAfterDays:16,
    description:'30-year fixed-rate mortgage average in the United States.'
  },
  housing_starts: {
    calendarKey:'housingStarts', label:'Housing starts', seriesId:'HOUST', unitsParam:'lin', units:'M SAAR', precision:2,
    category:'Housing', inputTarget:'housingSupply', transform:'thousands_to_millions', sourceAgency:'U.S. Census Bureau / HUD', frequency:'Monthly', staleAfterDays:85,
    description:'New privately-owned housing units started, seasonally adjusted annual rate.'
  },
  wti_oil: {
    calendarKey:'wtiOil', label:'WTI crude oil', seriesId:'DCOILWTICO', unitsParam:'lin', units:'$/bbl', precision:2,
    category:'Energy', inputTarget:'oil', sourceAgency:'U.S. Energy Information Administration', frequency:'Daily', staleAfterDays:12,
    description:'West Texas Intermediate crude oil spot price at Cushing, Oklahoma.'
  },
  henry_hub_gas: {
    calendarKey:'henryHubGas', label:'Henry Hub natural gas', seriesId:'DHHNGSP', unitsParam:'lin', units:'$/MMBtu', precision:2,
    category:'Energy', inputTarget:'natgas', sourceAgency:'U.S. Energy Information Administration', frequency:'Daily', staleAfterDays:12,
    description:'Henry Hub natural gas spot price.'
  },
  industrial_production: {
    calendarKey:'industrialProduction', label:'Industrial production growth', seriesId:'INDPRO', unitsParam:'pc1', units:'%', precision:2,
    category:'Production', sourceAgency:'Board of Governors of the Federal Reserve System', frequency:'Monthly', staleAfterDays:75,
    description:'Industrial Production Index, percent change from a year ago.'
  },
  real_pce_growth: {
    calendarKey:'realPceGrowth', label:'Real consumer spending growth', seriesId:'PCEC96', unitsParam:'pc1', units:'%', precision:2,
    category:'Consumption', sourceAgency:'U.S. Bureau of Economic Analysis', frequency:'Monthly', staleAfterDays:75,
    description:'Real personal consumption expenditures, percent change from a year ago.'
  }
};

export const CORE_DATA_SERIES = Object.freeze(Object.keys(DATA_SERIES));

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS live_series_catalog (
    series_key TEXT PRIMARY KEY,
    series_id TEXT NOT NULL,
    label TEXT NOT NULL,
    category TEXT,
    frequency TEXT,
    units TEXT,
    source_agency TEXT,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS live_latest (
    series_key TEXT PRIMARY KEY,
    series_id TEXT NOT NULL,
    observation_date TEXT NOT NULL,
    model_value REAL NOT NULL,
    previous_date TEXT,
    previous_model_value REAL,
    raw_value REAL,
    raw_previous REAL,
    provider TEXT NOT NULL,
    retrieved_at TEXT NOT NULL,
    payload_json TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS live_observation_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    series_key TEXT NOT NULL,
    series_id TEXT NOT NULL,
    observation_date TEXT NOT NULL,
    model_value REAL NOT NULL,
    raw_value REAL,
    provider TEXT NOT NULL,
    first_seen_at TEXT NOT NULL,
    payload_json TEXT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_live_history_unique
    ON live_observation_history(series_key, observation_date, model_value)`,
  `CREATE INDEX IF NOT EXISTS idx_live_history_series_date
    ON live_observation_history(series_key, observation_date DESC, first_seen_at DESC)`,
  `CREATE TABLE IF NOT EXISTS live_revisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    series_key TEXT NOT NULL,
    series_id TEXT NOT NULL,
    observation_date TEXT NOT NULL,
    old_value REAL NOT NULL,
    new_value REAL NOT NULL,
    detected_at TEXT NOT NULL,
    provider TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_live_revisions_detected
    ON live_revisions(detected_at DESC)`,
  `CREATE TABLE IF NOT EXISTS live_sync_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    status TEXT NOT NULL,
    requested_count INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    reason TEXT,
    details_json TEXT
  )`
];

function hasD1(env) {
  return !!env?.MACROSCOPE_DB && typeof env.MACROSCOPE_DB.prepare === 'function';
}

function isoNow() { return new Date().toISOString(); }

function numeric(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function roundTo(v, precision = 4) {
  const n = numeric(v);
  if (n === null) return null;
  const p = Math.max(0, Math.min(10, Number(precision) || 0));
  return Number(n.toFixed(p));
}

function ageDays(dateIso) {
  const t = Date.parse(`${dateIso}T00:00:00Z`);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

function applyModelTransform(def, value) {
  const n = numeric(value);
  if (n === null) return null;
  if (def.transform === 'thousands_to_millions') return n / 1000;
  return n;
}

function dateMinusYear(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

function transformRawRows(def, rows) {
  const clean = rows
    .map(r => ({date:String(r?.date || ''), value:numeric(r?.value)}))
    .filter(r => /^\d{4}-\d{2}-\d{2}$/.test(r.date) && r.value !== null)
    .sort((a,b) => a.date.localeCompare(b.date));
  if (!clean.length) return [];

  const mode = def.unitsParam || 'lin';
  const byDate = new Map(clean.map(r => [r.date, r.value]));
  const out = [];
  for (let i = 0; i < clean.length; i++) {
    const row = clean[i];
    let v = null;
    if (mode === 'lin') v = row.value;
    else if (mode === 'chg' && i > 0) v = row.value - clean[i - 1].value;
    else if (mode === 'pc1') {
      const target = dateMinusYear(row.date);
      let base = target ? byDate.get(target) : null;
      // Some source series use period-end dates that can shift slightly. If an
      // exact year-ago date is absent, use the nearest prior observation.
      if (base === undefined || base === null) {
        const targetMs = target ? Date.parse(`${target}T00:00:00Z`) : NaN;
        for (let j = i - 1; j >= 0; j--) {
          if (!Number.isFinite(targetMs) || Date.parse(`${clean[j].date}T00:00:00Z`) <= targetMs) {
            base = clean[j].value;
            break;
          }
        }
      }
      if (numeric(base) !== null && Math.abs(base) > 1e-12) v = 100 * (row.value / base - 1);
    }
    if (numeric(v) !== null) out.push({date:row.date, value:v, sourceValue:row.value});
  }
  return out;
}

function csvRows(text, seriesId) {
  const lines = String(text || '').trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map(x => x.trim().replace(/^"|"$/g,''));
  const dateIndex = Math.max(0, header.findIndex(x => /^(DATE|observation_date)$/i.test(x)));
  let valueIndex = header.findIndex(x => x === seriesId);
  if (valueIndex < 0) valueIndex = header.length > 1 ? 1 : -1;
  if (valueIndex < 0) return [];
  const rows = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(',').map(x => x.trim().replace(/^"|"$/g,''));
    const value = numeric(cols[valueIndex]);
    const date = cols[dateIndex];
    if (date && value !== null) rows.push({date,value});
  }
  return rows;
}

function lookbackStart(def) {
  const days = def.frequency === 'Quarterly' ? 2200 : def.frequency === 'Monthly' ? 900 : def.frequency === 'Weekly' ? 550 : 420;
  return new Date(Date.now() - days * 86400000).toISOString().slice(0,10);
}

async function fetchFredApiRows(env, def) {
  if (!env?.FRED_API_KEY) throw new Error('FRED_API_KEY not configured');
  const params = new URLSearchParams({
    series_id:def.seriesId,
    api_key:env.FRED_API_KEY,
    file_type:'json',
    observation_start:lookbackStart(def),
    sort_order:'asc',
    limit:'500',
    units:'lin'
  });
  const url = `https://api.stlouisfed.org/fred/series/observations?${params}`;
  const r = await fetch(url, {headers:{'Accept':'application/json','User-Agent':'MACROSCOPE-live-data/1.0'}});
  if (!r.ok) throw new Error(`FRED API ${def.seriesId} ${r.status}: ${(await r.text()).slice(0,220)}`);
  const payload = await r.json();
  const rows = (Array.isArray(payload?.observations) ? payload.observations : [])
    .map(o => ({date:o?.date, value:o?.value}))
    .filter(o => o.date && o.value !== '.' && numeric(o.value) !== null);
  if (!rows.length) throw new Error(`FRED API ${def.seriesId} returned no usable observations`);
  return rows;
}

async function fetchFredCsvRows(def) {
  const params = new URLSearchParams({id:def.seriesId, cosd:lookbackStart(def)});
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?${params}`;
  const r = await fetch(url, {headers:{'Accept':'text/csv','User-Agent':'MACROSCOPE-live-data/1.0'}});
  if (!r.ok) throw new Error(`FRED CSV ${def.seriesId} ${r.status}: ${(await r.text()).slice(0,220)}`);
  const rows = csvRows(await r.text(), def.seriesId);
  if (!rows.length) throw new Error(`FRED CSV ${def.seriesId} returned no usable observations`);
  return rows;
}

export async function fetchSeriesObservation(env, key) {
  const def = DATA_SERIES[key];
  if (!def) throw new Error(`Unknown approved data series: ${key}`);

  let rows;
  let provider;
  let apiError = null;
  try {
    rows = await fetchFredApiRows(env, def);
    provider = 'fred_api';
  } catch (err) {
    apiError = String(err?.message || err);
    rows = await fetchFredCsvRows(def);
    provider = 'fred_csv';
  }

  const transformed = transformRawRows(def, rows);
  if (!transformed.length) throw new Error(`Unable to transform ${def.seriesId}${apiError ? `; API fallback reason: ${apiError}` : ''}`);
  const latest = transformed.at(-1);
  const prior = transformed.at(-2) || null;
  const retrievedAt = isoNow();
  const aDays = ageDays(latest.date);
  const precision = Number.isFinite(Number(def.precision)) ? Number(def.precision) : 2;
  const rawValue = roundTo(latest.value, precision + 4);
  const rawPrevious = prior ? roundTo(prior.value, precision + 4) : null;
  const modelValue = roundTo(applyModelTransform(def, latest.value), precision + 4);
  const previousModelValue = prior ? roundTo(applyModelTransform(def, prior.value), precision + 4) : null;

  return {
    key,
    calendarKey:def.calendarKey || key,
    label:def.label,
    category:def.category,
    frequency:def.frequency,
    seriesId:def.seriesId,
    sourceAgency:def.sourceAgency,
    source:'Federal Reserve Bank of St. Louis FRED',
    sourceUrl:`https://fred.stlouisfed.org/series/${encodeURIComponent(def.seriesId)}`,
    provider,
    providerFallbackReason:provider === 'fred_csv' ? apiError : null,
    observationDate:latest.date,
    previousDate:prior?.date || null,
    rawValue,
    rawPrevious,
    modelValue,
    previousModelValue,
    units:def.units,
    precision,
    inputTarget:def.inputTarget || null,
    outputTarget:def.outputTarget || null,
    displayOnly:!def.inputTarget && !def.outputTarget,
    description:def.description,
    staleAfterDays:def.staleAfterDays || 45,
    ageDays:aDays,
    isStale:Number.isFinite(aDays) ? aDays > (def.staleAfterDays || 45) : false,
    retrievedAt
  };
}

export async function ensureLiveDataSchema(env) {
  if (!hasD1(env)) return false;
  await env.MACROSCOPE_DB.batch(SCHEMA_STATEMENTS.map(sql => env.MACROSCOPE_DB.prepare(sql)));
  return true;
}

async function upsertCatalog(env) {
  const now = isoNow();
  const statements = Object.entries(DATA_SERIES).map(([key, def]) => env.MACROSCOPE_DB.prepare(`
    INSERT INTO live_series_catalog(series_key,series_id,label,category,frequency,units,source_agency,updated_at)
    VALUES(?,?,?,?,?,?,?,?)
    ON CONFLICT(series_key) DO UPDATE SET
      series_id=excluded.series_id,label=excluded.label,category=excluded.category,
      frequency=excluded.frequency,units=excluded.units,source_agency=excluded.source_agency,updated_at=excluded.updated_at
  `).bind(key,def.seriesId,def.label,def.category || null,def.frequency || null,def.units || null,def.sourceAgency || null,now));
  if (statements.length) await env.MACROSCOPE_DB.batch(statements);
}

async function storeObservation(env, observation) {
  if (!hasD1(env)) return observation;
  const db = env.MACROSCOPE_DB;
  const now = observation.retrievedAt || isoNow();
  const priorLatest = await db.prepare(`SELECT observation_date, model_value, payload_json FROM live_latest WHERE series_key=?`).bind(observation.key).first();
  const firstForPeriod = await db.prepare(`SELECT model_value FROM live_observation_history WHERE series_key=? AND observation_date=? ORDER BY first_seen_at ASC LIMIT 1`).bind(observation.key, observation.observationDate).first();
  const initialRelease = numeric(firstForPeriod?.model_value);
  const effectiveInitial = initialRelease === null ? observation.modelValue : initialRelease;
  const revision = numeric(observation.modelValue) !== null && numeric(effectiveInitial) !== null
    ? roundTo(observation.modelValue - effectiveInitial, (observation.precision || 2) + 4)
    : null;
  const enriched = {...observation, initialRelease:effectiveInitial, revision};

  const changedSamePeriod = priorLatest && priorLatest.observation_date === observation.observationDate &&
    numeric(priorLatest.model_value) !== null && Math.abs(Number(priorLatest.model_value) - Number(observation.modelValue)) > 1e-10;

  const statements = [
    db.prepare(`INSERT OR IGNORE INTO live_observation_history(series_key,series_id,observation_date,model_value,raw_value,provider,first_seen_at,payload_json)
      VALUES(?,?,?,?,?,?,?,?)`).bind(observation.key,observation.seriesId,observation.observationDate,observation.modelValue,observation.rawValue,observation.provider,now,JSON.stringify(enriched)),
    db.prepare(`INSERT INTO live_latest(series_key,series_id,observation_date,model_value,previous_date,previous_model_value,raw_value,raw_previous,provider,retrieved_at,payload_json)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(series_key) DO UPDATE SET
        series_id=excluded.series_id,observation_date=excluded.observation_date,model_value=excluded.model_value,
        previous_date=excluded.previous_date,previous_model_value=excluded.previous_model_value,
        raw_value=excluded.raw_value,raw_previous=excluded.raw_previous,provider=excluded.provider,
        retrieved_at=excluded.retrieved_at,payload_json=excluded.payload_json`)
      .bind(observation.key,observation.seriesId,observation.observationDate,observation.modelValue,observation.previousDate,observation.previousModelValue,observation.rawValue,observation.rawPrevious,observation.provider,now,JSON.stringify(enriched))
  ];
  if (changedSamePeriod) {
    statements.push(db.prepare(`INSERT INTO live_revisions(series_key,series_id,observation_date,old_value,new_value,detected_at,provider)
      VALUES(?,?,?,?,?,?,?)`).bind(observation.key,observation.seriesId,observation.observationDate,Number(priorLatest.model_value),observation.modelValue,now,observation.provider));
  }
  await db.batch(statements);
  return enriched;
}

export async function refreshLiveData(env, options = {}) {
  if (!hasD1(env)) return {status:'unconfigured', ok:false, message:'MACROSCOPE_DB D1 binding is not configured.'};
  await ensureLiveDataSchema(env);
  await upsertCatalog(env);
  const startedAt = isoNow();
  const reason = String(options.reason || 'manual').slice(0,120);
  const startResult = await env.MACROSCOPE_DB.prepare(`INSERT INTO live_sync_runs(started_at,status,requested_count,reason) VALUES(?,?,?,?)`)
    .bind(startedAt,'running',CORE_DATA_SERIES.length,reason).run();
  const syncId = startResult?.meta?.last_row_id || null;

  const settled = await Promise.allSettled(CORE_DATA_SERIES.map(async key => {
    const obs = await fetchSeriesObservation(env, key);
    return storeObservation(env, obs);
  }));
  const updates = [];
  const errors = [];
  settled.forEach((res, i) => {
    if (res.status === 'fulfilled') updates.push(res.value);
    else errors.push({key:CORE_DATA_SERIES[i], error:String(res.reason?.message || res.reason).slice(0,700)});
  });
  const finishedAt = isoNow();
  const status = updates.length === CORE_DATA_SERIES.length ? 'complete' : updates.length ? 'partial' : 'failed';
  if (syncId) {
    await env.MACROSCOPE_DB.prepare(`UPDATE live_sync_runs SET finished_at=?,status=?,success_count=?,error_count=?,details_json=? WHERE id=?`)
      .bind(finishedAt,status,updates.length,errors.length,JSON.stringify({errors}),syncId).run();
  }
  return {ok:updates.length>0,status,startedAt,finishedAt,seriesCount:updates.length,errorCount:errors.length,errors};
}

function observationForOfficialData(payload) {
  const actual = numeric(payload?.modelValue);
  const previous = numeric(payload?.previousModelValue);
  const aDays = Number.isFinite(Number(payload?.ageDays)) ? Number(payload.ageDays) : ageDays(payload?.observationDate);
  return {
    key:payload?.calendarKey || payload?.key,
    seriesId:payload?.seriesId,
    label:payload?.label,
    category:payload?.category,
    frequency:payload?.frequency,
    units:payload?.units,
    precision:payload?.precision,
    observationDate:payload?.observationDate,
    actual,
    previous,
    previousDate:payload?.previousDate || null,
    change:actual !== null && previous !== null ? roundTo(actual - previous, (payload?.precision || 2) + 4) : null,
    initialRelease:numeric(payload?.initialRelease),
    revision:numeric(payload?.revision),
    inputTarget:payload?.inputTarget || null,
    outputTarget:payload?.outputTarget || null,
    ageDays:aDays,
    staleAfterDays:payload?.staleAfterDays || 45,
    isStale:Number.isFinite(aDays) ? aDays > (payload?.staleAfterDays || 45) : false,
    source:'FRED',
    provider:payload?.provider || 'fred_api',
    retrievedAt:payload?.retrievedAt || null
  };
}

export async function getLatestOfficialData(env) {
  if (!hasD1(env)) return {status:'unconfigured', officialData:null};
  try {
    const result = await env.MACROSCOPE_DB.prepare(`SELECT payload_json FROM live_latest ORDER BY series_key`).all();
    const rows = Array.isArray(result?.results) ? result.results : [];
    const observations = {};
    const baselineInputs = {};
    const baselineOutputs = {};
    let generatedAt = null;
    for (const row of rows) {
      let payload;
      try { payload = JSON.parse(row.payload_json); } catch { continue; }
      const obs = observationForOfficialData(payload);
      if (!obs.key || obs.actual === null) continue;
      observations[obs.key] = obs;
      if (obs.inputTarget) baselineInputs[obs.inputTarget] = obs.actual;
      if (obs.outputTarget) baselineOutputs[obs.outputTarget] = obs.actual;
      if (!generatedAt || String(obs.retrievedAt || '') > generatedAt) generatedAt = obs.retrievedAt;
    }
    const values = Object.values(observations);
    const staleCount = values.filter(o => o.isStale).length;
    return {
      status:values.length ? (staleCount ? 'partial' : 'complete') : 'empty',
      officialData:values.length ? {
        schemaVersion:2,
        country:'us',
        transport:'cloudflare-d1-live-gateway',
        status:staleCount ? 'partial' : 'complete',
        generatedAt:generatedAt || isoNow(),
        seriesCount:values.length,
        freshSeriesCount:values.length - staleCount,
        staleFallbackCount:staleCount,
        baseline:{inputs:baselineInputs,outputs:baselineOutputs},
        observations,
        errors:[],
        staleFallbacks:values.filter(o=>o.isStale).map(o=>o.key)
      } : null
    };
  } catch (err) {
    return {status:'uninitialized', officialData:null, error:String(err?.message || err)};
  }
}

export async function getLiveDataStatus(env) {
  if (!hasD1(env)) return {ok:false,status:'unconfigured',d1:false,message:'Add the MACROSCOPE_DB D1 binding to enable persistent automatic tracking.'};
  try {
    const latest = await env.MACROSCOPE_DB.prepare(`SELECT COUNT(*) AS count, MAX(retrieved_at) AS last_refresh FROM live_latest`).first();
    const lastRun = await env.MACROSCOPE_DB.prepare(`SELECT started_at,finished_at,status,requested_count,success_count,error_count,reason FROM live_sync_runs ORDER BY id DESC LIMIT 1`).first();
    const revisionCount = await env.MACROSCOPE_DB.prepare(`SELECT COUNT(*) AS count FROM live_revisions`).first();
    const lastRevision = await env.MACROSCOPE_DB.prepare(`SELECT series_key,series_id,observation_date,old_value,new_value,detected_at,provider FROM live_revisions ORDER BY detected_at DESC LIMIT 1`).first();
    return {
      ok:true,
      status:Number(latest?.count || 0) ? (lastRun?.status === 'partial' ? 'partial' : 'ready') : 'empty',
      d1:true,
      seriesCount:Number(latest?.count || 0),
      lastRefresh:latest?.last_refresh || null,
      lastRun:lastRun || null,
      revisionCount:Number(revisionCount?.count || 0),
      lastRevision:lastRevision || null
    };
  } catch (err) {
    return {ok:false,status:'uninitialized',d1:true,error:String(err?.message || err)};
  }
}

export async function getSeriesHistory(env, key, limit = 60) {
  const resolved = DATA_SERIES[key] ? key : Object.keys(DATA_SERIES).find(k => DATA_SERIES[k].seriesId === key || DATA_SERIES[k].calendarKey === key);
  if (!resolved) throw new Error(`Unknown series: ${key}`);
  if (!hasD1(env)) return {key:resolved,series:DATA_SERIES[resolved],history:[]};
  const lim = Math.max(1, Math.min(500, Number(limit) || 60));
  const result = await env.MACROSCOPE_DB.prepare(`SELECT observation_date,model_value,raw_value,provider,first_seen_at FROM live_observation_history WHERE series_key=? ORDER BY observation_date DESC,first_seen_at DESC LIMIT ?`)
    .bind(resolved,lim).all();
  return {key:resolved,series:DATA_SERIES[resolved],history:result?.results || []};
}

export async function getRevisionHistory(env, limit = 100) {
  if (!hasD1(env)) return {revisions:[]};
  const lim = Math.max(1, Math.min(500, Number(limit) || 100));
  const result = await env.MACROSCOPE_DB.prepare(`SELECT series_key,series_id,observation_date,old_value,new_value,detected_at,provider FROM live_revisions ORDER BY detected_at DESC LIMIT ?`).bind(lim).all();
  return {revisions:result?.results || []};
}

export async function getSeriesForCopilot(env, key, context = {}) {
  const def = DATA_SERIES[key];
  if (!def) throw new Error(`Unknown approved data series: ${key}`);
  let payload = null;
  if (hasD1(env)) {
    try {
      const row = await env.MACROSCOPE_DB.prepare(`SELECT payload_json FROM live_latest WHERE series_key=?`).bind(key).first();
      if (row?.payload_json) payload = JSON.parse(row.payload_json);
    } catch (_) { /* direct fetch fallback below */ }
  }
  if (!payload || payload.isStale) {
    payload = await fetchSeriesObservation(env, key);
    if (hasD1(env)) {
      try { payload = await storeObservation(env, payload); } catch (_) { /* keep fetched value */ }
    }
  }
  const currentInputs = context?.currentInputs || {};
  const currentOutputs = context?.currentOutputs || {};
  const currentValue = def.inputTarget ? numeric(currentInputs[def.inputTarget]) : def.outputTarget ? numeric(currentOutputs[def.outputTarget]) : null;
  return {...payload,currentValue};
}

export function publicCatalog() {
  return Object.fromEntries(Object.entries(DATA_SERIES).map(([key, def]) => [key, {
    seriesId:def.seriesId,label:def.label,category:def.category,frequency:def.frequency,units:def.units,
    sourceAgency:def.sourceAgency,inputTarget:def.inputTarget || null,outputTarget:def.outputTarget || null,description:def.description
  }]));
}
