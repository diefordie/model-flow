// scripts/smoke.cjs — end-to-end smoke against live Supabase + local API + worker.
const fs = require('fs');
const path = require('path');

const ENV = Object.fromEntries(
  fs.readFileSync(path.join(__dirname, '..', 'apps', 'api', '.env'), 'utf8')
    .split('\n').filter(Boolean).map(l => l.split('=', 2))
);
const API = 'http://127.0.0.1:3001/api/v1';
const JWT = fs.readFileSync('/tmp/smoke-jwt.txt', 'utf8').trim();
const AUTH = { Authorization: `Bearer ${JWT}`, apikey: ENV.SUPABASE_ANON_KEY };

function assert(cond, msg) {
  if (!cond) { console.error(`FAIL: ${msg}`); process.exit(1); }
  console.log(`  OK ${msg}`);
}

async function http(method, url, body, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const init = { method, headers };
  if (body) init.body = typeof body === 'string' ? body : JSON.stringify(body);
  const r = await fetch(url, init);
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: r.status, text, json };
}

async function pollStatus(experimentId, maxSec = 90) {
  for (let i = 0; i < maxSec; i += 2) {
    const r = await http('GET', `${API}/experiments/${experimentId}/status`, null, { headers: AUTH });
    if (r.status !== 200) { console.log(`  poll status http=${r.status}`); }
    const st = r.json?.status || r.json?.data?.status || 'unknown';
    const stage = r.json?.current_stage || r.json?.data?.current_stage || '';
    const prog = r.json?.progress ?? r.json?.data?.progress ?? '?';
    console.log(`  t=${i}s status=${st} stage=${stage} progress=${prog}`);
    if (st === 'completed') return 'completed';
    if (st === 'failed') return 'failed';
    await new Promise(r => setTimeout(r, 2000));
  }
  return 'timeout';
}

(async () => {
  console.log('--- 1. Create project ---');
  const proj = await http('POST', `${API}/projects`, { name: 'smoke-iris' }, { headers: AUTH });
  assert(proj.status === 200 || proj.status === 201, `project create http=${proj.status}`);
  const projectId = proj.json?.data?.id ?? proj.json?.id;
  assert(projectId, `projectId=${projectId}`);

  console.log('--- 2. Upload iris.csv ---');
  const csvPath = path.join(__dirname, 'sample_data', 'iris.csv');
  const csvBuf = fs.readFileSync(csvPath);
  const form = new FormData();
  form.append('file', new Blob([csvBuf], { type: 'text/csv' }), 'iris.csv');
  const up = await fetch(`${API}/projects/${projectId}/datasets`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${JWT}`, apikey: ENV.SUPABASE_ANON_KEY },
    body: form,
  });
  const upText = await up.text();
  let upJson; try { upJson = JSON.parse(upText); } catch {}
  assert(up.status === 200 || up.status === 201, `dataset upload http=${up.status}`);
  const datasetId = upJson?.data?.id ?? upJson?.id;
  assert(datasetId, `datasetId=${datasetId}`);

  console.log('--- 3. Wait for profiling to finish (poll columns/profile) ---');
  let profiled = false;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const p = await http('GET', `${API}/datasets/${datasetId}/profile`, null, { headers: AUTH });
    const cols = p.json?.data?.columns || p.json?.columns || [];
    if (p.status === 200 && cols.length > 0) {
      console.log(`  t=${(i+1)*2}s columns=${cols.length}`);
      profiled = true;
      break;
    }
    console.log(`  t=${(i+1)*2}s profiling http=${p.status} cols=${cols.length}`);
  }
  assert(profiled, 'profiling completed');

  console.log('--- 4. Models registry ---');
  const m = await http('GET', `${API}/models?task=classification`, null, { headers: AUTH });
  assert(m.status === 200, `models registry http=${m.status}`);
  const modelList = m.json?.data?.models || m.json?.models || [];
  assert(Array.isArray(modelList) && modelList.length >= 1, `models count=${modelList.length}`);
  const lrId = (modelList.find(x => x.id === 'logistic_regression') || modelList[0]).id;
  console.log(`  using model=${lrId}`);

  console.log('--- 5. Create experiment (classification, target=classification) ---');
  const exp = await http('POST', `${API}/experiments`, {
    name: 'smoke-experiment',
    taskType: 'classification',
    datasetId,
    target: 'classification',
    features: ['sepallength', 'sepalwidth', 'petallength', 'petalwidth'],
    preprocessing: { scaling: 'standard', missingValues: 'mean' },
    model: { type: lrId, parameters: { max_iter: 200 } },
    training: { testSize: 0.2, randomState: 42, optimizationMethod: 'manual' },
  }, { headers: AUTH });
  assert(exp.status === 200 || exp.status === 201, `experiment create http=${exp.status}`);
  const experimentId = exp.json?.data?.id ?? exp.json?.experimentId ?? exp.json?.id;
  assert(experimentId, `experimentId=${experimentId}`);

  console.log('--- 6. Poll until completed (≤90s) ---');
  const finalStatus = await pollStatus(experimentId, 90);
  assert(finalStatus === 'completed', `experiment final status=${finalStatus}`);

  console.log('--- 7. Fetch results ---');
  const res = await http('GET', `${API}/experiments/${experimentId}/results`, null, { headers: AUTH });
  assert(res.status === 200, `results http=${res.status}`);
  const metrics = res.json?.metrics;
  assert(metrics && typeof metrics === 'object' && Object.keys(metrics).length > 0, `metrics keys=${Object.keys(metrics || {}).join(',')}`);
  console.log(`  metrics: ${Object.entries(metrics).map(([k,v]) => `${k}=${typeof v === 'number' ? v.toFixed(3) : v}`).join(', ')}`);

  console.log('--- 8. Predict ---');
  const pred = await http('POST', `${API}/experiments/${experimentId}/predict`, {
    features: { sepallength: 5.1, sepalwidth: 3.5, petallength: 1.4, petalwidth: 0.2 },
  }, { headers: AUTH });
  assert(pred.status === 200, `predict http=${pred.status}`);
  console.log(`  prediction: ${(JSON.stringify(pred.json) || '').slice(0, 200)}`);

  console.log('\n✅ SMOKE PASSED');
  console.log(`  projectId=${projectId} datasetId=${datasetId} experimentId=${experimentId}`);
})().catch(e => { console.error('SMOKE EXCEPTION', e); process.exit(1); });