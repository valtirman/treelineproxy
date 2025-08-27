
// --- Helpers ---
const $ = (sel) => document.querySelector(sel);
const byId = (id) => document.getElementById(id);

function luhnCheck(num) {
  const digits = num.replace(/\D/g, '').split('').reverse().map(n => parseInt(n, 10));
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = digits[i];
    if (i % 2 === 1) {
      d = d * 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return (sum % 10) === 0;
}

function redact(text) {
  // Order matters: replace more specific patterns first
  const patterns = [
    { name: 'OpenAI key', regex: /\bsk-[A-Za-z0-9]{20,}\b/g, red: '[REDACTED]' },
    { name: 'JWT', regex: /\b[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\b/g, red: '[REDACTED]' },
    { name: 'SSN', regex: /\b\d{3}-\d{2}-\d{4}\b/g, red: '[REDACTED]' },
    { name: 'Email', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, red: '[REDACTED]' },
    // Credit cards: mask sequences of 13-19 digits with optional spaces/dashes
    { name: 'Card', regex: /\b(?:\d[ -]*?){13,19}\b/g, red: (m) => (luhnCheck(m) ? '[REDACTED]' : m) },
    { name: 'Bearer token', regex: /Authorization:\s*Bearer\s+[A-Za-z0-9._\-]+/gi, red: 'Authorization: Bearer [REDACTED]' },
  ];
  let redacted = text;
  for (const p of patterns) {
    redacted = redacted.replace(p.regex, (m) => (typeof p.red === 'function' ? p.red(m) : p.red));
  }
  return redacted;
}

function scan(text) {
  const findings = [];
  const checks = [
    { name: 'OpenAI key', regex: /\bsk-[A-Za-z0-9]{20,}\b/g, post: null },
    { name: 'JWT', regex: /\b[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\b/g, post: null },
    { name: 'SSN', regex: /\b\d{3}-\d{2}-\d{4}\b/g, post: null },
    { name: 'Email', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, post: null },
    { name: 'Bearer token', regex: /Authorization:\s*Bearer\s+[A-Za-z0-9._\-]+/gi, post: null },
    { name: 'Card (Luhn‑valid)', regex: /\b(?:\d[ -]*?){13,19}\b/g, post: 'luhn' },
  ];
  for (const c of checks) {
    const matches = [...text.matchAll(c.regex)].map(m => m[0]);
    if (matches.length) {
      if (c.post === 'luhn') {
        const valid = matches.filter(luhnCheck);
        if (valid.length) findings.push({ name: c.name, count: valid.length });
      } else {
        findings.push({ name: c.name, count: matches.length });
      }
    }
  }
  return findings;
}

// --- Wire up Scanner ---
const scanBtn = byId('scan-btn');
const redactBtn = byId('redact-btn');
const scanInput = byId('scan-input');
const scanResults = byId('scan-results');
const copyRedacted = byId('copy-redacted');

scanBtn?.addEventListener('click', () => {
  const text = scanInput.value || '';
  const out = scan(text);
  if (!text.trim()) {
    scanResults.textContent = 'Paste text, then click Scan.';
    return;
  }
  if (!out.length) {
    scanResults.textContent = 'No obvious secrets/PII found.';
    return;
  }
  const lines = out.map(f => `• ${f.name}: ${f.count}`).join('\n');
  scanResults.textContent = lines;
});

redactBtn?.addEventListener('click', () => {
  const text = scanInput.value || '';
  scanInput.value = redact(text);
});

copyRedacted?.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(scanInput.value || '');
    copyRedacted.textContent = 'Copied ✓';
    setTimeout(() => copyRedacted.textContent = 'Copy redacted', 1200);
  } catch {}
});

// --- Prompt Builder ---
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
  try {
    await navigator.clipboard.writeText(out.value || '');
    copyBuilt.textContent = 'Copied ✓';
    setTimeout(() => copyBuilt.textContent = 'Copy', 1200);
  } catch {}
});
