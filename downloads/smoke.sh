#!/usr/bin/env bash
set -euo pipefail
PROXY="${PROXY:-http://127.0.0.1:15050}"

echo "== Health =="
curl -fsS http://127.0.0.1:18080/ready && echo "LIVE"

echo "== Header block (403) =="
curl -i -x "$PROXY" -k https://example.com/ -H 'Authorization: Bearer x' -d hi -o /dev/null -w "%{http_code}\n"

echo "== OpenAI key block (403) =="
curl -i -x "$PROXY" -k https://example.com/ --data 'sk-123456789012345678901234' -o /dev/null -w "%{http_code}\n"

echo "== Redaction =="
curl -s -x "$PROXY" -k https://postman-echo.com/post -H 'content-type: text/plain'   --data 'email a@b.com SSN 123-45-6789 CC 4242 4242 4242 4242' | jq -r '.data'

echo "== Metrics =="
curl -s http://127.0.0.1:9096/metrics | egrep 'treeline_requests_total|treeline_decisions_total' | sort || true
