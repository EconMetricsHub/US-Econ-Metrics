import assert from 'node:assert/strict';
import { fetchSeriesObservation, getSeriesForCopilot } from '../src/live-data.js';

const originalFetch = globalThis.fetch;
const fixtures = {
  CPIAUCSL: `observation_date,CPIAUCSL\n2025-01-01,100\n2025-02-01,101\n2026-01-01,105\n2026-02-01,107.06\n`,
  PAYEMS: `observation_date,PAYEMS\n2026-01-01,160000\n2026-02-01,160125\n`,
  HOUST: `observation_date,HOUST\n2026-01-01,1450\n2026-02-01,1500\n`,
  DFF: `observation_date,DFF\n2026-02-01,4.25\n2026-02-02,4.30\n`
};

globalThis.fetch = async url => {
  const u = new URL(String(url));
  const id = u.searchParams.get('id');
  if (!id || !fixtures[id]) return new Response('missing fixture', {status:404});
  return new Response(fixtures[id], {status:200,headers:{'content-type':'text/csv'}});
};

try {
  const cpi = await fetchSeriesObservation({}, 'headline_cpi');
  assert.equal(cpi.provider, 'fred_csv');
  assert.equal(cpi.observationDate, '2026-02-01');
  assert.ok(Math.abs(cpi.modelValue - 6) < 0.0001, `expected 6% CPI YoY, got ${cpi.modelValue}`);

  const payroll = await fetchSeriesObservation({}, 'payroll_change');
  assert.equal(payroll.modelValue, 125);

  const housing = await fetchSeriesObservation({}, 'housing_starts');
  assert.equal(housing.modelValue, 1.5);

  const ffr = await getSeriesForCopilot({}, 'fed_funds', {currentInputs:{ffr:4.5}});
  assert.equal(ffr.modelValue, 4.3);
  assert.equal(ffr.currentValue, 4.5);

  console.log('live-data tests: PASS');
} finally {
  globalThis.fetch = originalFetch;
}
