
const byId = (id) => document.getElementById(id);
const buildBtn = byId('build-btn');
const copyBuilt = byId('copy-built');
const out = byId('built-output');

buildBtn?.addEventListener('click', () => {
  const role = byId('b-role').value || 'expert assistant';
  const task = byId('b-task').value || 'solve the user request';
  const data = byId('b-data').value || '';
  const fmt = byId('b-format').value || 'bullet list';
  const tone = byId('b-tone').value || 'concise';
  const cons = byId('b-constraints').value || 'cite assumptions; ask 1‑2 clarifying questions if needed; avoid fluff.';

  const prompt = `You are ${role}.
Task: ${task}.
${data ? `Context: ${data}.` : ''}
Constraints: ${cons}

Write the answer as a ${fmt}. Use the tone: ${tone}.
If information is missing, state what you assumed. Provide a short next‑steps checklist.`.trim();

  out.value = prompt;
  out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

copyBuilt?.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(out.value || ''); copyBuilt.textContent='Copied ✓'; setTimeout(()=>copyBuilt.textContent='Copy',1200);} catch {}
});
