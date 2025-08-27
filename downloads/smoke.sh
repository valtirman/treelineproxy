#!/usr/bin/env bash
set -euo pipefail
PROXY="${PROXY:-http://127.0.0.1:15050}"
echo "== 0) Health =="
curl -fsS http://127.0.0.1:18080/ready && echo "LIVE" || (echo "health failed" && exit 1)
echo "== 1) HEADER BLOCK should 403 =="
code=$(curl -i -s -x "$PROXY" -k https://example.com/ -H 'Authorization: Bearer abc' -d hi -o /dev/null -w "%{http_code}"); echo "$code"; test "$code" = "403"
echo "== 2) BODY BLOCK (OpenAI key) should 403 =="
code=$(curl -i -s -x "$PROXY" -k https://example.com/ --data 'sk-123456789012345678901234' -o /dev/null -w "%{http_code}"); echo "$code"; test "$code" = "403"
echo "== 3) REDACTION =="
curl -s -x "$PROXY" -k https://postman-echo.com/post -H 'content-type: text/plain' --data 'email a@b.com SSN 123-45-6789 CC 4242 4242 4242 4242' | sed -n 's/.*"data":"\(.*\)".*/\1/p' | sed 's/\\n/\n/g'
echo "== 4) METRICS snapshot =="
curl -s http://127.0.0.1:9096/metrics | egrep 'treeline_requests_total|treeline_decisions_total' | sort || true
echo "OK"
