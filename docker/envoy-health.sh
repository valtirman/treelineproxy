#!/usr/bin/env sh
set -eu

# 1) Admin /ready must be LIVE
curl -fsS http://127.0.0.1:19901/ready | grep -q LIVE

# 2) (Optional assist) Best-effort TCP connect to upstream host. If this fails,
#    active HC will also be failing; we don't hard-fail here to avoid race-flap.
curl -sfm 1 telnet://mitmproxy:8080 >/dev/null 2>&1 || true

# 3) Cluster must report >=1 healthy host (correct metric name in Envoy 1.29)
VAL=$(
  curl -fsS "http://127.0.0.1:19901/stats?format=prometheus" \
  | awk -F' ' '/^envoy_cluster_membership_healthy\{[^}]*envoy_cluster_name="mitm"[^}]*\} /{print $2; exit}'
)

[ -n "${VAL:-}" ] || exit 1
printf "%s" "$VAL" | grep -Eq '^[0-9]+$' || exit 1
[ "$VAL" -ge 1 ] || exit 1
exit 0
