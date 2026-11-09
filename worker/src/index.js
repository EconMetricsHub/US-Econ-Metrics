import { DATA_SERIES, CORE_DATA_SERIES, getSeriesForCopilot, refreshLiveData, getLatestOfficialData, getLiveDataStatus, getSeriesHistory, getRevisionHistory, publicCatalog } from './live-data.js';

const REGIONS = ['us','eu','uk','jp','cn','em'];
const OPS = ['set','increase','decrease'];

function allowedOrigins(env) {
  return (env.ALLOWED_ORIGIN || '*').split(',').map(x => x.trim()).filter(Boolean);
}

function originAllowed(origin, env) {
  const allowed = allowedOrigins(env);
  return allowed.includes('*') || (!!origin && allowed.includes(origin));
}

function cors(origin, env) {
  const allowed = allowedOrigins(env);
  const use = allowed.includes('*') ? '*' : (allowed.includes(origin) ? origin : allowed[0]);
  return {
    'Access-Control-Allow-Origin': use || '*',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Vary': 'Origin'
  };
}

function clamp(v, a, b, d) {
  v = Number(v);
  return Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : d;
}

function safeString(v, max = 1200) {
  return String(v ?? '').slice(0, max);
}

function parseModelJson(text) {
  let raw = String(text ?? '').trim();
  if (!raw) throw new Error('Empty model response');
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(raw); } catch (_) {}
  const a = raw.indexOf('{');
  const b = raw.lastIndexOf('}');
  if (a >= 0 && b > a) {
    try { return JSON.parse(raw.slice(a, b + 1)); } catch (_) {}
  }
  throw new Error('Model returned invalid JSON');
}

function boolish(v, fallback = false) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const x = v.trim().toLowerCase();
    if (['true','yes','on','1'].includes(x)) return true;
    if (['false','no','off','0'].includes(x)) return false;
  }
  return fallback;
}

function normalizeScenarioDraft(input, context) {
  let raw = input && typeof input === 'object' ? input : {};
  if (raw.command && typeof raw.command === 'object') raw = raw.command;
  else if (raw.scenario && typeof raw.scenario === 'object') raw = raw.scenario;
  else if (raw.result && typeof raw.result === 'object') raw = raw.result;

  const settingsRaw = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
  const trRaw = settingsRaw.taylorRule || settingsRaw.taylor_rule || raw.taylorRule || raw.taylor_rule || {};
  const shockRaw = raw.shock && typeof raw.shock === 'object' ? raw.shock : {};
  const rawChanges = raw.sliderChanges || raw.slider_changes || raw.changes || [];
  const rawChannels = shockRaw.channels || shockRaw.shockChannels || shockRaw.shock_channels || [];

  return {
    registryVersion: raw.registryVersion ?? raw.registry_version ?? context?.registryVersion ?? 'unknown',
    scenarioName: raw.scenarioName ?? raw.scenario_name ?? raw.name ?? 'AI counterfactual',
    region: raw.region ?? context?.country ?? 'us',
    confidence: raw.confidence,
    rationale: raw.rationale ?? raw.summary ?? '',
    assumptions: Array.isArray(raw.assumptions) ? raw.assumptions : [],
    sliderChanges: (Array.isArray(rawChanges) ? rawChanges : []).map(c => ({
      id: c?.id ?? c?.sliderId ?? c?.slider_id ?? '',
      operation: c?.operation ?? c?.op ?? 'set',
      value: c?.value ?? c?.delta ?? c?.amount,
      reason: c?.reason ?? c?.rationale ?? ''
    })),
    settings: {
      taylorRule: {
        apply: boolish(trRaw?.apply, false),
        enabled: boolish(trRaw?.enabled, boolish(context?.taylorRuleEnabled, false)),
        reason: trRaw?.reason ?? trRaw?.rationale ?? ''
      }
    },
    shock: {
      enabled: boolish(shockRaw.enabled, Array.isArray(rawChannels) && rawChannels.length > 0),
      label: shockRaw.label ?? shockRaw.name ?? raw.scenarioName ?? raw.scenario_name ?? 'AI scenario shock',
      category: shockRaw.category ?? 'Custom',
      shockType: shockRaw.shockType ?? shockRaw.shock_type ?? shockRaw.type ?? 'persistent',
      durationMonths: shockRaw.durationMonths ?? shockRaw.duration_months,
      peakMonth: shockRaw.peakMonth ?? shockRaw.peak_month,
      decayRate: shockRaw.decayRate ?? shockRaw.decay_rate,
      confidence: shockRaw.confidence ?? raw.confidence,
      magnitude: shockRaw.magnitude,
      rationale: shockRaw.rationale ?? shockRaw.reason ?? '',
      assumptions: Array.isArray(shockRaw.assumptions) ? shockRaw.assumptions : [],
      channels: (Array.isArray(rawChannels) ? rawChannels : []).map(c => ({
        target: c?.target ?? c?.id ?? c?.channel ?? '',
        effect: c?.effect ?? c?.value ?? c?.impact,
        lagMonths: c?.lagMonths ?? c?.lag_months ?? c?.lag ?? 0,
        peakMonth: c?.peakMonth ?? c?.peak_month ?? c?.peak ?? 1
      }))
    }
  };
}

function registryFromContext(context) {
  const sliders = Array.isArray(context?.sliderRegistry) ? context.sliderRegistry : [];
  const shocks = Array.isArray(context?.shockTargets) ? context.shockTargets : [];
  const sliderMap = new Map();
  const shockMap = new Map();
  for (const x of sliders) {
    if (!x?.id) continue;
    sliderMap.set(String(x.id), {
      id: String(x.id),
      label: safeString(x.label || x.id, 100),
      unit: safeString(x.unit || 'model_units', 60),
      minimum: Number(x.minimum ?? x.min),
      maximum: Number(x.maximum ?? x.max),
      step: Number(x.step) || 1,
      currentValue: Number(x.currentValue ?? x.cur),
      allowedOperations: Array.isArray(x.allowedOperations ?? x.ops) ? (x.allowedOperations ?? x.ops).filter(v => OPS.includes(v)) : OPS,
      economicMeaning: safeString(x.economicMeaning || x.description || x.label || '', 180),
      downstreamEffects: []
    });
  }
  for (const x of shocks) {
    if (!x?.id) continue;
    shockMap.set(String(x.id), {
      id: String(x.id),
      label: safeString(x.label || x.id, 100),
      unit: safeString(x.unit || 'model_units', 60),
      minimum: Number(x.minimum ?? x.min),
      maximum: Number(x.maximum ?? x.max),
      economicMeaning: safeString(x.economicMeaning || x.description || x.label || '', 160)
    });
  }
  if (!sliderMap.size) throw new Error('No slider registry supplied by the application');
  if (!shockMap.size) throw new Error('No shock-target registry supplied by the application');
  return {sliderMap, shockMap};
}

function scenarioSchema(sliderIds, shockIds) {
  return {
    type: 'object',
    properties: {
      registryVersion: {type: 'string'},
      scenarioName: {type: 'string'},
      region: {type: 'string', enum: REGIONS},
      confidence: {type: 'number'},
      rationale: {type: 'string'},
      assumptions: {type: 'array', items: {type: 'string'}},
      sliderChanges: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: {type: 'string'},
            operation: {type: 'string', enum: OPS},
            value: {type: 'number'},
            reason: {type: 'string'}
          },
          required: ['id','operation','value','reason'],
          additionalProperties: false
        }
      },
      settings: {
        type: 'object',
        properties: {
          taylorRule: {
            type: 'object',
            properties: {
              apply: {type: 'boolean'},
              enabled: {type: 'boolean'},
              reason: {type: 'string'}
            },
            required: ['apply','enabled','reason'],
            additionalProperties: false
          }
        },
        required: ['taylorRule'],
        additionalProperties: false
      },
      shock: {
        type: 'object',
        properties: {
          enabled: {type: 'boolean'},
          label: {type: 'string'},
          category: {type: 'string'},
          shockType: {type: 'string', enum: ['temporary','persistent','structural']},
          durationMonths: {type: 'integer'},
          peakMonth: {type: 'integer'},
          decayRate: {type: 'number'},
          confidence: {type: 'number'},
          magnitude: {type: 'number'},
          rationale: {type: 'string'},
          assumptions: {type: 'array', items: {type: 'string'}},
          channels: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                target: {type: 'string'},
                effect: {type: 'number'},
                lagMonths: {type: 'integer'},
                peakMonth: {type: 'integer'}
              },
              required: ['target','effect','lagMonths','peakMonth'],
              additionalProperties: false
            }
          }
        },
        required: ['enabled','label','category','shockType','durationMonths','peakMonth','decayRate','confidence','magnitude','rationale','assumptions','channels'],
        additionalProperties: false
      }
    },
    required: ['registryVersion','scenarioName','region','confidence','rationale','assumptions','sliderChanges','settings','shock'],
    additionalProperties: false
  };
}

function validateScenario(raw, context, registry) {
  const {sliderMap, shockMap} = registry;
  const region = REGIONS.includes(context?.country) ? context.country : 'us';
  const changes = [];
  for (const c of (Array.isArray(raw?.sliderChanges) ? raw.sliderChanges : []).slice(0, 12)) {
    const def = sliderMap.get(String(c?.id || ''));
    if (!def) continue;
    const op = def.allowedOperations.includes(c.operation) ? c.operation : 'set';
    let value = Number(c.value);
    if (!Number.isFinite(value)) continue;
    if (op === 'set') value = clamp(value, def.minimum, def.maximum, def.currentValue);
    else value = Math.abs(value);
    const base = Number.isFinite(def.currentValue) ? def.currentValue : 0;
    const rawFinal = op === 'set' ? value : op === 'increase' ? base + value : base - value;
    const finalValue = clamp(rawFinal, def.minimum, def.maximum, base);
    changes.push({
      id: def.id,
      operation: op,
      value,
      finalValue,
      reason: safeString(c.reason, 500)
    });
  }

  const shockRaw = raw?.shock || {};
  const channels = [];
  for (const c of (Array.isArray(shockRaw.channels) ? shockRaw.channels : []).slice(0, 5)) {
    const def = shockMap.get(String(c?.target || ''));
    if (!def) continue;
    const effect = clamp(c.effect, def.minimum, def.maximum, 0);
    if (Math.abs(effect) < 1e-12) continue;
    channels.push({
      target: def.id,
      effect,
      lagMonths: Math.round(clamp(c.lagMonths, 0, 60, 0)),
      peakMonth: Math.round(clamp(c.peakMonth, 1, 120, 1))
    });
  }
  const enabled = !!shockRaw.enabled && channels.length > 0;
  const type = ['temporary','persistent','structural'].includes(shockRaw.shockType) ? shockRaw.shockType : 'persistent';
  const shock = {
    enabled,
    label: safeString(shockRaw.label || raw?.scenarioName || 'AI scenario shock', 120),
    category: safeString(shockRaw.category || 'Custom', 40),
    shockType: type,
    durationMonths: Math.round(clamp(shockRaw.durationMonths, 1, 240, type === 'temporary' ? 9 : type === 'structural' ? 120 : 36)),
    peakMonth: Math.round(clamp(shockRaw.peakMonth, 1, 120, type === 'temporary' ? 2 : type === 'structural' ? 12 : 4)),
    decayRate: clamp(shockRaw.decayRate, 0, 1, type === 'structural' ? 0 : 0.08),
    confidence: clamp(shockRaw.confidence, 0.05, 1, 0.65),
    magnitude: clamp(shockRaw.magnitude, 0.05, 3, 1),
    rationale: safeString(shockRaw.rationale, 1200),
    assumptions: (Array.isArray(shockRaw.assumptions) ? shockRaw.assumptions : []).slice(0, 6).map(x => safeString(x, 300)),
    channels
  };

  return {
    registryVersion: safeString(context?.registryVersion || raw?.registryVersion || 'unknown', 40),
    scenarioName: safeString(raw?.scenarioName || 'AI counterfactual', 120),
    region,
    confidence: clamp(raw?.confidence, 0.05, 1, 0.6),
    rationale: safeString(raw?.rationale, 1500),
    assumptions: (Array.isArray(raw?.assumptions) ? raw.assumptions : []).slice(0, 8).map(x => safeString(x, 350)),
    sliderChanges: changes,
    settings: {
      taylorRule: {
        apply: !!raw?.settings?.taylorRule?.apply,
        enabled: !!raw?.settings?.taylorRule?.enabled,
        reason: safeString(raw?.settings?.taylorRule?.reason, 500)
      }
    },
    shock
  };
}

async function callProvider(env, body) {
  if (!env.LLM_API_KEY) throw new Error('LLM_API_KEY is not configured');
  const base = (env.LLM_API_BASE || 'https://api.groq.com/openai/v1').replace(/\/$/, '');
  const r = await fetch(base + '/chat/completions', {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${env.LLM_API_KEY}`},
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`Provider ${r.status}: ${(await r.text()).slice(0, 500)}`);
  const data = await r.json();
  const choice = data?.choices?.[0] || {};
  const message = choice?.message || {};
  const raw = message?.content;
  if (!raw || !String(raw).trim()) {
    const finish = safeString(choice?.finish_reason || 'unknown', 60);
    const reasoning = safeString(message?.reasoning || '', 240);
    const usage = data?.usage || {};
    const detail = reasoning
      ? `; reasoning was produced but no final content (${reasoning.length} chars sampled)`
      : '';
    throw new Error(
      `Empty provider response (finish_reason=${finish}, completion_tokens=${usage?.completion_tokens ?? 'unknown'}${detail})`
    );
  }
  return String(raw);
}

function scenarioReasoningEffort(context) {
  const raw = String(context?.aiOptions?.reasoningEffort || 'low').toLowerCase();
  return ['low','medium','high'].includes(raw) ? raw : 'low';
}
function scenarioCompletionBudget(effort) {
  return effort === 'high' ? 4400 : effort === 'medium' ? 3400 : 2600;
}
async function callScenarioProvider(env, body, effort='low') {
  const budget = scenarioCompletionBudget(effort);
  const primary = {
    ...body,
    reasoning_effort: effort,
    include_reasoning: false,
    max_completion_tokens: Math.max(Number(body?.max_completion_tokens) || 0, budget)
  };
  try {
    return await callProvider(env, primary);
  } catch (e) {
    const msg = String(e?.message || e);
    if (!/Provider 400:|response_format|json|Empty provider response/i.test(msg)) throw e;

    // Retry once with the simplest supported output mode. GPT-OSS can spend a
    // large share of its completion budget on reasoning; low effort plus a
    // larger completion budget leaves room for the final JSON object.
    const fallback = {
      ...primary,
      temperature: 0.5,
      reasoning_effort: effort,
      include_reasoning: false,
      max_completion_tokens: Math.max(3000, budget),
      messages: [...(body.messages || [])]
    };
    delete fallback.response_format;
    if (fallback.messages[0]?.role === 'system') {
      fallback.messages[0] = {
        ...fallback.messages[0],
        content: fallback.messages[0].content +
          '\n\nRETRY MODE: Return exactly one compact valid JSON object. No markdown, no prose before or after the JSON. Keep rationale and reasons brief.'
      };
    }
    return await callProvider(env, fallback);
  }
}


// ── V7.2: SOURCED DATA COPILOT ──────────────────────────────────
// The LLM may choose which approved series are relevant, but factual values are
// read from the validated Live Data Gateway. The model never invents observations or sources.
async function selectDataSeries(env, prompt) {
  const text = String(prompt || '').toLowerCase();
  if (/bring\s+macroscope\s+(fully\s+)?current|bring\s+the\s+model\s+(fully\s+)?current|update\s+(all|the)\s+(major\s+)?(macro|economic|official|data)|latest\s+(available\s+)?(major\s+)?(u\.s\.\s+)?(macro|economic|official)\s+data|fully\s+current\s+using\s+the\s+latest/.test(text)) {
    return {series: CORE_DATA_SERIES, rationale:'Broad current-data refresh requested.'};
  }
  const keys = Object.keys(DATA_SERIES);
  const catalog = keys.map(k => `${k}: ${DATA_SERIES[k].label} — ${DATA_SERIES[k].description}`).join('\n');
  const body = {
    model: env.LLM_MODEL || 'openai/gpt-oss-20b',
    messages: [
      {role:'system', content:`You select official economic data series for MACROSCOPE. Choose only from the approved catalog. Select every series necessary to answer the user's request, but avoid unrelated series. If the user asks generally for the latest macro data or to bring the model current, select the full core set. Do not provide data values; another system fetches them from FRED.\n\nAPPROVED CATALOG:\n${catalog}`},
      {role:'user', content:String(prompt || '')}
    ],
    temperature:0,
    max_completion_tokens:450,
    response_format:{
      type:'json_schema',
      json_schema:{
        name:'macroscope_data_selection', strict:true,
        schema:{
          type:'object',
          properties:{
            series:{type:'array',items:{type:'string',enum:keys},minItems:1,maxItems:keys.length},
            rationale:{type:'string'}
          },
          required:['series','rationale'], additionalProperties:false
        }
      }
    }
  };
  const raw = await callProvider(env, body);
  const parsed = JSON.parse(raw);
  const series = Array.isArray(parsed?.series) ? [...new Set(parsed.series.filter(k => DATA_SERIES[k]))] : [];
  return {series:series.length ? series : CORE_DATA_SERIES, rationale:safeString(parsed?.rationale || '', 700)};
}

async function buildDataUpdateProposal(env, prompt, context) {
  const selection = await selectDataSeries(env, prompt);
  const results = await Promise.allSettled(selection.series.map(k => getSeriesForCopilot(env, k, context)));
  const updates = [];
  const errors = [];
  results.forEach((res, i) => {
    if (res.status === 'fulfilled') updates.push(res.value);
    else errors.push({key:selection.series[i], error:String(res.reason?.message || res.reason)});
  });
  if (!updates.length) throw new Error(`No official series could be retrieved${errors.length ? ': '+errors.map(e=>e.error).join(' | ').slice(0,700) : ''}`);
  return {
    kind:'official_data_update',
    generatedAt:new Date().toISOString(),
    prompt:safeString(prompt, 1200),
    rationale:selection.rationale,
    updates,
    errors,
    provenanceNote:'Values come from the MACROSCOPE Live Data Gateway using approved FRED series. The LLM selects series only; it never generates observations. D1 is preferred, with direct FRED retrieval as a safe fallback.'
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const h = cors(origin, env);
    const url = new URL(request.url);
    const json = (payload, status=200) => new Response(JSON.stringify(payload), {status, headers:{...h,'Content-Type':'application/json','Cache-Control':'no-store'}});
    if (request.method === 'OPTIONS') return new Response(null, {headers: h});
    if (request.method === 'POST' && !originAllowed(origin, env)) {
      return new Response(JSON.stringify({error:'Origin not allowed'}), {status:403, headers:{...h,'Content-Type':'application/json'}});
    }
    if (request.method === 'GET') {
      try {
        if (url.pathname === '/api/data/status') return json(await getLiveDataStatus(env));
        if (url.pathname === '/api/data/catalog') return json({catalog:publicCatalog()});
        if (url.pathname === '/api/data/revisions') return json(await getRevisionHistory(env, url.searchParams.get('limit') || 100));
        if (url.pathname.startsWith('/api/data/series/')) {
          const key = decodeURIComponent(url.pathname.slice('/api/data/series/'.length));
          return json(await getSeriesHistory(env, key, url.searchParams.get('limit') || 60));
        }
        if (url.pathname === '/api/data/latest') {
          let live = await getLatestOfficialData(env);
          const wantsRefresh = url.searchParams.get('refresh') === '1';
          let shouldRefresh = live.status === 'empty' || live.status === 'uninitialized';
          if (wantsRefresh && live.status !== 'unconfigured') {
            const status = await getLiveDataStatus(env);
            const last = status?.lastRefresh ? Date.parse(status.lastRefresh) : NaN;
            if (!Number.isFinite(last) || Date.now() - last > 5 * 60 * 1000) shouldRefresh = true;
          }
          // First-visit bootstrap and rate-limited user refresh: neither requires
          // rebuilding or redeploying the static site.
          if (shouldRefresh) {
            const refresh = await refreshLiveData(env, {reason:wantsRefresh ? 'frontend-refresh' : 'bootstrap-on-first-read'});
            if (refresh.ok) live = await getLatestOfficialData(env);
          }
          return json(live, live.officialData ? 200 : (live.status === 'unconfigured' ? 503 : 200));
        }
        const dataStatus = await getLiveDataStatus(env);
        return json({
          ok:true,
          service:'MACROSCOPE AI + Live Data Gateway',
          model:env.LLM_MODEL || 'openai/gpt-oss-20b',
          ai:{configured:!!env.LLM_API_KEY, provider:'groq', model:env.LLM_MODEL || 'openai/gpt-oss-20b'},
          data:dataStatus
        });
      } catch (e) {
        return json({error:String(e?.message || e)},500);
      }
    }
    if (request.method !== 'POST') return new Response(JSON.stringify({error:'POST only'}), {status:405, headers:{...h,'Content-Type':'application/json'}});

    try {
      const {prompt, context, mode} = await request.json();
      const text = String(prompt || '').trim();
      if (!text || text.length > 12000) return new Response(JSON.stringify({error:'Prompt required (max 12000 chars)'}), {status:400, headers:{...h,'Content-Type':'application/json'}});

      if (mode === 'data_update') {
        const proposal = await buildDataUpdateProposal(env, text, context || {});
        return new Response(JSON.stringify({proposal}), {headers:{...h,'Content-Type':'application/json'}});
      }

      if (mode === 'analyst') {
        const system = `You are the explanation layer for MACROSCOPE, a transparent macroeconomic counterfactual simulator. Use ONLY the simulator context supplied by the user. Distinguish model outputs, user assumptions, and observed/release data. Do not invent current prices, news, events, or model coefficients. Explain causal chains, countervailing forces, uncertainty, and the largest drivers. If baseline and counterfactual outputs are provided, compare them directly. Portfolio results are scenario sensitivities, not investment advice or price forecasts. Be concise but substantive.`;
        const body = {
          model: env.LLM_MODEL || 'openai/gpt-oss-20b',
          messages: [
            {role:'system', content:system},
            {role:'user', content:`SIMULATOR CONTEXT:\n${JSON.stringify(context || {})}\n\nQUESTION:\n${text}`}
          ],
          temperature: 0.25,
          max_completion_tokens: 1400
        };
        const answer = await callProvider(env, body);
        return new Response(JSON.stringify({answer}), {headers:{...h,'Content-Type':'application/json'}});
      }

      const registry = registryFromContext(context);
      const system = `You are the scenario-construction layer for MACROSCOPE. Translate the user's economic counterfactual into a cautious JSON command. You do NOT execute code, manipulate the interface, or invent new controls. Use only slider IDs and shock-target IDs supplied in the compact simulator context. Unknown IDs are rejected server-side.\n\nUse sliderChanges for persistent state or policy changes that correspond to existing controls. For temporary, lagged, or explicitly time-bounded macro effects, use the structured shock object. A scenario may use both. If the user asks to enable or disable the Taylor Rule, set settings.taylorRule.apply=true and choose enabled accordingly. Otherwise set apply=false and preserve the current Taylor Rule state in enabled. Do not change the region; return the current context country.\n\nOperations: set means the requested absolute level; increase/decrease means a positive delta from the current value. Respect units, ranges, and economic meaning from the registry. Do not force every plausible channel into the scenario. Prefer the smallest defensible set of controls, generally 1-8 slider changes and no more than 5 shock channels. Do not claim causal certainty. Preserve ambiguity as assumptions and lower confidence when the prompt is underspecified.\n\nReturn exactly ONE JSON object and no markdown. Use this shape: {\"scenarioName\":\"...\",\"region\":\"us\",\"confidence\":0.6,\"rationale\":\"...\",\"assumptions\":[],\"sliderChanges\":[{\"id\":\"...\",\"operation\":\"set|increase|decrease\",\"value\":0,\"reason\":\"...\"}],\"settings\":{\"taylorRule\":{\"apply\":false,\"enabled\":false,\"reason\":\"...\"}},\"shock\":{\"enabled\":true,\"label\":\"...\",\"category\":\"Custom\",\"shockType\":\"temporary|persistent|structural\",\"durationMonths\":12,\"peakMonth\":2,\"decayRate\":0.08,\"confidence\":0.6,\"magnitude\":1,\"rationale\":\"...\",\"assumptions\":[],\"channels\":[{\"target\":\"...\",\"effect\":0,\"lagMonths\":0,\"peakMonth\":2}]}}. The server will normalize minor field-shape mistakes and independently validate every ID, range, operation, and shock target.\n\nFor financial or economic news, treat the text as a scenario input rather than verified truth unless the context marks it as observed data.`;
      const body = {
        model: env.LLM_MODEL || 'openai/gpt-oss-20b',
        messages: [
          {role:'system', content:system},
          {role:'user', content:`SIMULATOR CONTEXT:\n${JSON.stringify(context || {})}\n\nCOUNTERFACTUAL OR NEWS INPUT:\n${text}`}
        ],
        temperature: 0.15,
        max_completion_tokens: 1200,
        response_format: {type:'json_object'}
      };
      const effort = scenarioReasoningEffort(context);
      const raw = await callScenarioProvider(env, body, effort);
      const parsed = parseModelJson(raw);
      const normalized = normalizeScenarioDraft(parsed, context);
      const command = validateScenario(normalized, context, registry);
      return new Response(JSON.stringify({command}), {headers:{...h,'Content-Type':'application/json'}});
    } catch (e) {
      return new Response(JSON.stringify({error:String(e?.message || e)}), {status:500, headers:{...h,'Content-Type':'application/json'}});
    }
  },

  async scheduled(controller, env, ctx) {
    const task = refreshLiveData(env, {reason:`cron:${controller.cron || 'scheduled'}`});
    if (ctx?.waitUntil) ctx.waitUntil(task);
    else await task;
  }
};
