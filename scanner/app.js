/* Treeline Prompt Risk Scanner — app.js
   v2025-08-11-8 (cache-busting + diagnostics compatibility + optional remote hook)
*/

/* ------------------------------ Config ---------------------------------- */
const RULES_VERSION = '2025-08-11-9'; // bump when rules change to bust CDN caches
// Optional remote endpoints for deeper checks (set in index.html):
// <script>window.__TREELINE_API__ = ['https://your-api/scan'];</script>
const API_ENDPOINTS = Array.isArray(window.__TREELINE_API__) ? window.__TREELINE_API__ : [];

/* ------------------------------ State ----------------------------------- */
const state = {
  packs: {},
  profile: 'chatbot',
  strict: false,
  contentType: 'prompt',
  text: '',
  scores: { injection:0, jailbreak:0, exfil:0, secrets:0, pii:0, dos:0 }
};

const els = {
  text:null, runBtn:null, exportBtn:null, charCount:null, tokCount:null, costRisk:null,
  profile:null, contentType:null, strictMode:null, scoreGrid:null, findings:null,
  sampleList:null, randSample:null
};

/* --------------------------- Bootstrapping ------------------------------- */
document.addEventListener('DOMContentLoaded', init);

async function init(){
  bind();
  try {
    await loadPacks();
    statusBanner(
      'packs loaded — ' +
      'baseline=' + (state.packs?.baseline?.injection||[]).length + ', ' +
      'jailbreak=' + (state.packs?.jailbreak?.rules||[]).length + ', ' +
      'exfil=' + (state.packs?.exfil?.rules||[]).length + ', ' +
      'secrets=' + (state.packs?.secrets?.rules||[]).length + ', ' +
      'pii=' + (state.packs?.pii?.rules||[]).length + ' • remote=' + API_ENDPOINTS.length,
      'ok'
    );
  } catch (e) {
    console.warn('Rule loading error:', e);
    statusBanner('rules failed to load — using minimal fallbacks', 'warn');
    applyMinimalFallbacks();
  }
  try { await loadSamples(); } catch { /* non-fatal */ }
  renderScores();
  handleCounts();
}

function bind(){
  els.text = byId('text');
  els.runBtn = byId('runBtn');
  els.exportBtn = byId('exportBtn');
  els.charCount = byId('charCount');
  els.tokCount = byId('tokCount');
  els.costRisk = byId('costRisk');
  els.profile = byId('profile');
  els.contentType = byId('contentType');
  els.strictMode = byId('strictMode');
  els.scoreGrid = byId('scoreGrid');
  els.findings = byId('findings');
  els.sampleList = byId('sampleList');
  els.randSample = byId('randSample');

  els.text?.addEventListener('input', handleCounts);
  els.profile?.addEventListener('change', e => state.profile = e.target.value);
  els.contentType?.addEventListener('change', e => state.contentType = e.target.value);
  els.strictMode?.addEventListener('change', e => state.strict = e.target.checked);
  els.runBtn?.addEventListener('click', runChecks);
  els.exportBtn?.addEventListener('click', exportReport);
  els.randSample?.addEventListener('click', pickRandomSample);

  state.profile = els.profile?.value || 'chatbot';
  state.contentType = els.contentType?.value || 'prompt';
}

/* --------------------------- Data Loading -------------------------------- */
async function loadPacks(){
  const files = ['baseline','pii','jailbreak','secrets','exfil','profiles'];
  const loaded = {};
  for (const f of files){
    loaded[f] = await fetchJSON(`./rules/${f}.json`);
    sanityCheckPack(f, loaded[f]);
  }
  state.packs = loaded;
}

function sanityCheckPack(name, pack){
  if (name === 'baseline' && !Array.isArray(pack?.injection)) throw new Error('baseline.json missing "injection" array');
  if (['pii','jailbreak','secrets','exfil'].includes(name) && !Array.isArray(pack?.rules)) throw new Error(name + '.json missing "rules" array');
  if (name === 'profiles' && typeof pack?.chatbot !== 'object') throw new Error('profiles.json missing profiles');
}

async function loadSamples(){
  const list = await fetchJSON('./assets/samples.json');
  if (!els.sampleList) return;
  els.sampleList.innerHTML = '';
  for (const s of list){
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.textContent = s.title;
    b.title = s.hint || '';
    b.addEventListener('click', () => { els.text.value = s.text; handleCounts(); });
    li.appendChild(b);
    els.sampleList.appendChild(li);
  }
}
function pickRandomSample(){
  const items = Array.from(els.sampleList?.querySelectorAll('button')||[]);
  if (items.length) items[Math.floor(Math.random()*items.length)].click();
}

async function fetchJSON(path){
  const url = path + '?v=' + encodeURIComponent(RULES_VERSION);
  const res = await fetch(url, { cache:'no-cache' });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + path);
  return res.json();
}

/* ---------------------------- UI Helpers --------------------------------- */
function statusBanner(msg, kind){
  const el = document.createElement('div');
  const color = kind === 'ok' ? '#10b981' : '#f59e0b';
  el.style.cssText = 'position:sticky;top:0;z-index:9999;padding:6px 10px;background:#111827;color:#fff;border-left:4px solid ' + color + ';font:12px/1.3 system-ui';
  el.textContent = msg;
  document.body.prepend(el);
}
function byId(id){ return document.getElementById(id); }
function escapeHTML(s){ return String(s).replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[m]); }); }
function snippet(s){ s = String(s); return s.length > 240 ? s.slice(0,240) + '…' : s; }

/* --------------------------- Editor Metrics ------------------------------ */
function handleCounts(){
  const t = els.text?.value || '';
  state.text = t;
  if (els.charCount) els.charCount.textContent = String(t.length);
  const tok = estimateTokens(t);
  if (els.tokCount) els.tokCount.textContent = String(tok);
  if (els.costRisk) els.costRisk.textContent = tok > 2000 ? 'High' : (tok > 800 ? 'Medium' : 'Low');
}
function estimateTokens(s){ return s ? Math.ceil(String(s).length / 4) : 0; }

/* ---------------------------- Scoring UI --------------------------------- */
function renderScores(){
  const cats = [
    ['injection','Prompt Injection'],
    ['jailbreak','Jailbreak'],
    ['exfil','Exfiltration'],
    ['secrets','Secrets'],
    ['pii','PII/PHI'],
    ['dos','DoS/Cost']
  ];
  if (!els.scoreGrid) return;
  els.scoreGrid.innerHTML = '';
  for (const c of cats){
    const key = c[0], label = c[1];
    const div = document.createElement('div');
    div.className = 'score';
    div.innerHTML =
      '<h3>' + label + ' <span id="score-' + key + '">0</span>/100</h3>' +
      '<div class="gauge"><div id="bar-' + key + '" class="bar"></div></div>';
    els.scoreGrid.appendChild(div);
  }
}
function setScore(cat, val){
  const n = Math.max(0, Math.min(100, Math.round(val)));
  const sp = byId('score-' + cat); const bar = byId('bar-' + cat);
  if (sp) sp.textContent = String(n);
  if (bar) bar.style.width = n + '%';
}

/* ----------------------------- Findings ---------------------------------- */
function resetResults(){
  state.scores = { injection:0, jailbreak:0, exfil:0, secrets:0, pii:0, dos:0 };
  if (els.findings) els.findings.innerHTML = '';
  renderScores();
}

// (SAFE VERSION) — no nested template literals
function addFinding(args){
  if (!els.findings) return;
  const category = args.category, severity = args.severity, ruleId = args.ruleId;
  const message = args.message || '(no message)';
  const match = args.match, fix = args.fix;

  const catHTML  = '<span class="cat">' + escapeHTML(category) + '</span>';
  const sevHTML  = '<span class="sev ' + escapeHTML(severity) + '">' + String(severity||'').toUpperCase() + '</span>';
  const msgHTML  = '<strong>' + escapeHTML(message) + '</strong>';
  const fixHTML  = fix ? ' — <span class="muted">' + escapeHTML(fix) + '</span>' : '';
  const matchHTML= match ? '<div class="code">' + escapeHTML(snippet(match)) + '</div>' : '';
  const ruleHTML = '<div class="muted">Rule: <code>' + escapeHTML(ruleId || 'n/a') + '</code></div>';

  const div = document.createElement('div');
  div.className = 'finding';
  div.innerHTML =
    '<div>' + catHTML + ' ' + sevHTML + '</div>' +
    '<div>' + msgHTML + fixHTML + '</div>' +
    matchHTML +
    ruleHTML;

  els.findings.appendChild(div);
}

/* ----------------------------- Profiles ---------------------------------- */
function weightFor(cat){
  const p = state.packs?.profiles?.[state.profile] || {};
  return (p.weights && typeof p.weights[cat] === 'number') ? p.weights[cat] : 1;
}

/* ----------------------------- Rule Eval --------------------------------- */
function applyRules(rules, category, text){
  let score = 0;
  if (!Array.isArray(rules)) return 0;
  for (let i=0; i<rules.length; i++){
    const r = rules[i];
    try {
      const re = new RegExp(r.pattern, r.flags || 'i');
      const m = String(text).match(re);
      if (m){
        const sev = r.severity || 'med';
        const bump = sev === 'high' ? 30 : (sev === 'med' ? 15 : 7);
        score += bump;
        addFinding({
          category: category, severity: sev, ruleId: r.id,
          message: r.message, match: m[0], fix: r.fix
        });
      }
    } catch (e) {
      console.warn('Bad rule ' + category + ':' + (r && r.id), e);
    }
  }
  return score;
}

/* ----------------------------- Scanner ----------------------------------- */
async function runChecks(){
  resetResults();
  const t = (state.text || '').trim();
  if (!t) return;

  const packs = state.packs;
  const base = packs?.baseline;
  const pii = packs?.pii;
  const jb = packs?.jailbreak;
  const sec = packs?.secrets;
  const exf = packs?.exfil;

  // Local checks
  let sInjection = applyRules(base?.injection, 'injection', t);
  let sJail = applyRules(jb?.rules, 'jailbreak', t);
  let sExfil = applyRules(exf?.rules, 'exfil', t);
  let sSecrets = applyRules(sec?.rules, 'secrets', t);
  let sPII = applyRules(pii?.rules, 'pii', t);

  // DoS/Cost heuristics
  let sDoS = 0;
  const tok = estimateTokens(t);
  if (tok > 3000) sDoS += 35; else if (tok > 1200) sDoS += 18;
  if (/\brepeat this step\b|\bkeep answering\b|\bignore any limits\b/i.test(t)) sDoS += 18;

  // Strict mode
  if (state.strict){
    sInjection *= 1.15; sJail *= 1.15; sExfil *= 1.10; sSecrets *= 1.10; sPII *= 1.05; sDoS *= 1.05;
  }
  // Profile weights
  function W(k,v){ return v * weightFor(k); }
  sInjection = W('injection', sInjection);
  sJail      = W('jailbreak', sJail);
  sExfil     = W('exfil', sExfil);
  sSecrets   = W('secrets', sSecrets);
  sPII       = W('pii', sPII);
  sDoS       = W('dos', sDoS);

  state.scores = clampScores({
    injection:sInjection, jailbreak:sJail, exfil:sExfil,
    secrets:sSecrets, pii:sPII, dos:sDoS
  });
  for (const k in state.scores) setScore(k, state.scores[k]);

  // Optional remote scan (only if endpoints configured)
  if (API_ENDPOINTS.length){
    const remote = await callRemoteScan(t, state.profile);
    if (remote && remote.extra) mergeExtra(remote.extra);
  }
}

function clampScores(obj){
  const out = {};
  for (const k in obj) out[k] = Math.max(0, Math.min(100, Math.round(obj[k])));
  return out;
}

/* ------------------------- Remote (optional) ----------------------------- */
async function callRemoteScan(text, profile){
  for (let i=0;i<API_ENDPOINTS.length;i++){
    const url = API_ENDPOINTS[i];
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, profile })
      });
      if (res.ok) return await res.json();
    } catch (_) {}
  }
  return null;
}

function bump(cat, n){
  state.scores[cat] = Math.max(0, Math.min(100, Math.round(state.scores[cat] + n)));
  setScore(cat, state.scores[cat]);
}

function mergeExtra(extra){
  if (extra.approx_injection){
    bump('injection', 12);
    addFinding({
      category: 'injection', severity: 'med', ruleId: 'remote.approx_injection',
      message: 'Fuzzy similarity to instruction-override phrasing.',
      fix: 'Remove/bound override or “ignore previous instructions” language.'
    });
  }
  if (extra.highRisk){
    bump('exfil', 20);
    addFinding({
      category: 'exfil', severity: 'high', ruleId: 'remote.highRisk',
      message: 'Serverless detector flagged high-risk prompt exfil request.',
      fix: 'Block requests to reveal hidden/system/developer prompts.'
    });
  }
}

/* ---------------------------- Export ------------------------------------- */
function exportReport(){
  const now = new Date().toISOString();
  const payload = {
    metadata: {
      generated_at: now,
      profile: state.profile,
      strict: state.strict,
      content_type: state.contentType,
      token_estimate: estimateTokens(state.text)
    },
    scores: state.scores,
    findings: Array.from(document.querySelectorAll('.finding')).map(function(el){ return el.innerText; }),
    text: state.text
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  download(blob, 'treeline-scan-' + now.replace(/[:.]/g,'-') + '.json');
}

function download(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(function(){ URL.revokeObjectURL(url); }, 60000);
}

/* ------------------------ Minimal Fallbacks ------------------------------ */
function applyMinimalFallbacks(){
  state.packs = state.packs || {};
  if (!state.packs.baseline) state.packs.baseline = { injection: [
    { id:'inj.ignore.previous', pattern:'\\b(ignore|disregard) (all|previous|above) (instructions|rules)\\b', severity:'high', message:'Attempts to override prior instructions.', fix:'Remove instruction override phrasing.' }
  ]};
  if (!state.packs.jailbreak) state.packs.jailbreak = { rules: [] };
  if (!state.packs.exfil) state.packs.exfil = { rules: [] };
  if (!state.packs.secrets) state.packs.secrets = { rules: [] };
  if (!state.packs.pii) state.packs.pii = { rules: [] };
  if (!state.packs.profiles) state.packs.profiles = {
    chatbot: { weights: { injection:1, jailbreak:1, exfil:1, secrets:1, pii:1, dos:1 } }
  };
}
