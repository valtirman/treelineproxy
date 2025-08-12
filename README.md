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
