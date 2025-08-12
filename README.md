# Treeline Prompt Risk Scanner

[![Status](https://img.shields.io/badge/status-stable-brightgreen)](#)
[![Version](https://img.shields.io/badge/scanner-v1.0.0-blue)](#)
[![License](https://img.shields.io/badge/license-MIT-lightgrey)](#license)

**Live demo:** https://treelineproxy.io/scanner/  
Local-first, policy-driven checks for LLM prompts/outputs. No API calls.

## Features
- Detects: **Injection**, **Jailbreak**, **Exfiltration**, **Secrets**, **PII/PHI**, **DoS/Cost**
- Explainable hits (rule ID, message, match snippet)
- Profiles: Chatbot, RAG, Agent, Code with category weights
- One-click test prompts in Samples library
- Cache-busted deploys; diagnostics panel for quick checks

## Quick start
```bash
cd scanner
python3 -m http.server 8080
# open http://localhost:8080/scanner/

Rules & scoring
Rules in /scanner/rules/ (baseline, jailbreak, exfil, secrets, pii, profiles)
Deterministic scoring (low/med/high → 7/15/30) × profile weights
Strict mode: +5–15% across categories

Dev workflow
Edit rules/JS
Bump RULES_VERSION in scanner/app.js and ?v= in scanner/index.html
Run Samples → Full spectrum — red team to verify deploy

Roadmap
Fuzzy/semantic detection (n-gram/char-gram)
Optional serverless checks (CF Worker / AWS Lambda)
Rule-pack CI and CLI runner
Signed policy updates

---

**2. CHANGELOG.md**  
Create a new file in repo root: `CHANGELOG.md`:

```markdown
# Treeline Prompt Risk Scanner — Changelog

## v1.0.0 — 2025-08-12
**Status:** Stable (GA)

### Highlights
- Category coverage: Injection, Jailbreak, Exfiltration, Secrets, PII/PHI, DoS/Cost
- Rule packs: `/scanner/rules/` (baseline, jailbreak, exfil, secrets, pii, profiles)
- Explainable matches and deterministic scoring
- Profiles with category weights; Strict mode
- Diagnostics panel (`/scanner/diag.js`) and 8 curated samples
- Cache-busted deploys with `RULES_VERSION` and `?v=`

### Verified
- Full-spectrum sample lights up all categories
- Rules load cleanly with non-zero counts
