/* Treeline Prompt Risk Scanner — Local-first policy engine */
const state = {
  packs: {},
  profile: 'chatbot',
  strict: false,
  contentType: 'prompt',
  text: '',
  scores: { injection:0, jailbreak:0, exfil:0, secrets:0, pii:0, dos:0 },
  findings: []
};

const els = {
  text: null, runBtn: null, exportBtn: null, charCount:null, tokCount:null, costRisk:null,
  profile: null, strictMode:null, contentType:null, scoreGrid:null, findings:null, sampleList:null, randSample:null
};

document.addEventListener('DOMContentLoaded', async () => {
  bind();
  await loadPacks();
  await loadSamples();
  renderScores();
  handleCounts();
});

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

  els.text.addEventListener('input', handleCounts);
  els.profile.addEventListener('change', e => state.profile = e.target.value);
  els.contentType.addEventListener('change', e => state.contentType = e.target.value);
  els.strictMode.addEventListener('change', e => state.strict = e.target.checked);
  els.runBtn.addEventListener('click', runChecks);
  els.exportBtn.addEventListener('click', exportReport);
  els.randSample.addEventListener('click', pickRandomSample);

  // default profile
  state.profile = els.profile.value;
  state.contentType = els.contentType.value;
}

async function loadPacks(){
  const files = ['baseline','pii','jailbreak','secrets','exfil','profiles'];
  for (const f of files){
    state.packs[f] = await fetchJSON(`./rules/${f}.json`);
  }
}

async function loadSamples(){
  const list = await fetchJSON('./assets/samples.json');
  els.sampleList.innerHTML = '';
  for (const s of list){
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.textContent = s.title;
    b.title = s.hint || '';
    b.addEventListener('click', () => {
      els.text.value = s.text;
      handleCounts();
    });
    li.appendChild(b);
    els.sampleList.appendChild(li);
  }
}

function pickRandomSample(){
  const items = [...els.sampleList.querySelectorAll('button')];
  if (!items.length) return;
  items[Math.floor(Math.random()*items.length)].click();
}

function handleCounts(){
  const t = els.text.value || '';
  state.text = t;
  els.charCount.textContent = t.length.toString();
  const tok = estimateTokens(t);
  els.tokCount.textContent = tok.toString();
  els.costRisk.textContent = tok > 2000 ? 'High' : tok > 800 ? 'Medium' : 'Low';
}

function estimateTokens(s){
  // Heuristic when no tokenizer present: ~4 chars/token
  if (!s) return 0;
  return Math.ceil(s.length / 4);
}

function renderScores(){
  const cats = [
    ['injection','Prompt Injection'],
    ['jailbreak','Jailbreak'],
    ['exfil','Exfiltration'],
    ['secrets','Secrets'],
    ['pii','PII/PHI'],
    ['dos','DoS/Cost']
  ];
  els.scoreGrid.innerHTML = '';
  for (const [key,label] of cats){
    const div = document.createElement('div');
    div.className = 'score';
    div.innerHTML = `
      <h3>${label} <span id="score-${key}">0</span>/100</h3>
      <div class="gauge"><div id="bar-${key}" class="bar"></div></div>
    `;
    els.scoreGrid.appendChild(div);
  }
}

function setScore(cat, val){
  const n = Math.max(0, Math.min(100, Math.round(val)));
  byId(`score-${cat}`).textContent = n.toString();
  byId(`bar-${cat}`).style.width = `${n}%`;
}

function addFinding({category, severity, ruleId, message, match, fix}){
  const div = document.createElement('div');
  div.className = 'finding';
  div.innerHTML = `
    <div><span class="cat">${category}</span> <span class="sev ${severity}">${severity.toUpperCase()}</span></div>
    <div><strong>${message}</strong> ${fix ? `— <span class="muted">${fix}</span>` : ''}</div>
    ${match ? `<div class="code">${escapeHTML(snippet(match))}</div>` : ''}
    <div class="muted">Rule: <code>${ruleId}</code></div>
  `;
  els.findings.appendChild(div);
}

function escapeHTML(s){ return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function snippet(s){ return s.length > 240 ? s.slice(0,240)+'…' : s; }

function weightFor(cat){
  const p = state.packs.profiles[state.profile] || {};
  return (p.weights && typeof p.weights[cat] === 'number') ? p.weights[cat] : 1;
}

function resetResults(){
  state.scores = { injection:0, jailbreak:0, exfil:0, secrets:0, pii:0, dos:0 };
  state.findings = [];
  els.findings.innerHTML = '';
  renderScores();
}

function applyRules(rules, category, text){
  let score = 0;
  for (const r of rules){
    const re = new RegExp(r.pattern, r.flags || 'i');
    const m = text.match(re);
    if (m){
      // increment with severity and weight
      const sev = r.severity || 'med';
      const bump = sev === 'high' ? 30 : sev === 'med' ? 15 : 7;
      score += bump;
      addFinding({
        category,
        severity: sev,
        ruleId: r.id,
        message: r.message,
        match: m[0],
        fix: r.fix
      });
    }
  }
  return score;
}

async function runChecks(){
  resetResults();
  const t = state.text.trim();
  if (!t){ return; }

  const { baseline, pii, jailbreak, secrets, exfil } = state.packs;

  // Base heuristics
  let sInjection = applyRules(baseline.injection, 'injection', t);
  let sJail = applyRules(jailbreak.rules, 'jailbreak', t);
  let sExfil = applyRules(exfil.rules, 'exfil', t);
  let sSecrets = applyRules(secrets.rules, 'secrets', t);
  let sPII = applyRules(pii.rules, 'pii', t);

  // DoS/Cost: token & loop bait heuristics
  let sDoS = 0;
  const tok = estimateTokens(t);
  if (tok > 3000) sDoS += 35;
  else if (tok > 1200) sDoS += 18;

  if (/\brepeat this step\b|\bkeep answering\b|\bignore any limits\b/i.test(t)) sDoS += 18;

  // Strict mode bump
  if (state.strict){
    sInjection *= 1.15; sJail *= 1.15; sExfil *= 1.1; sSecrets *= 1.1; sPII *= 1.05; sDoS *= 1.05;
  }

  // Apply profile weights
  const applyW = (cat,val) => val * weightFor(cat);
  sInjection = applyW('injection', sInjection);
  sJail = applyW('jailbreak', sJail);
  sExfil = applyW('exfil', sExfil);
  sSecrets = applyW('secrets', sSecrets);
  sPII = applyW('pii', sPII);
  sDoS = applyW('dos', sDoS);

  state.scores = clampScores({injection:sInjection, jailbreak:sJail, exfil:sExfil, secrets:sSecrets, pii:sPII, dos:sDoS});
  for (const k of Object.keys(state.scores)) setScore(k, state.scores[k]);
}

function clampScores(obj){
  const out = {};
  for (const k of Object.keys(obj)) out[k] = Math.max(0, Math.min(100, Math.round(obj[k])));
  return out;
}

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
    findings: [...document.querySelectorAll('.finding')].map((el) => el.innerText),
    text: state.text
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  download(blob, `treeline-scan-${now.replace(/[:.]/g,'-')}.json`);
}

function download(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function byId(id){ return document.getElementById(id); }
async function fetchJSON(path){
  const res = await fetch(path, {cache:'no-cache'});
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}
