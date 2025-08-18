from mitmproxy import http, ctx
import os, re, json, threading, time
from http.server import BaseHTTPRequestHandler, HTTPServer

RULES_FILE = os.getenv("RULES_FILE", "/addons/rules.json")
RELOAD_SECONDS = int(os.getenv("RELOAD_SECONDS", "5"))
METRICS_PORT = int(os.getenv("METRICS_PORT", "9090"))

_lock = threading.RLock()
_block_patterns = []
_redact_patterns = []
metrics = {"requests_total": 0, "blocked_total": 0, "redacted_total": 0}

# one-time guards (mitm can call load() multiple times)
_metrics_started = False
_reloader_started = False

def _load_rules():
    try:
        with open(RULES_FILE, "r") as f:
            data = json.load(f)
        block = [re.compile(p) for p in data.get("block", [])]
        redact = [re.compile(p) for p in data.get("redact", [])]
        return block, redact
    except Exception as e:
        ctx.log.warn(f"[rules] load failed: {e}")
        return [], []

def _reloader():
    global _block_patterns, _redact_patterns
    last_mtime = None
    while True:
        try:
            mtime = os.stat(RULES_FILE).st_mtime
            if mtime != last_mtime:
                b, r = _load_rules()
                with _lock:
                    _block_patterns, _redact_patterns = b, r
                ctx.log.info(f"[rules] reloaded ({len(b)} block, {len(r)} redact)")
                last_mtime = mtime
        except FileNotFoundError:
            pass
        except Exception as e:
            ctx.log.warn(f"[rules] reload error: {e}")
        time.sleep(RELOAD_SECONDS)

class _Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args): return
    def do_GET(self):
        if self.path == "/healthz":
            self.send_response(200); self.end_headers(); self.wfile.write(b"ok"); return
        if self.path == "/metrics":
            with _lock:
                body = (
                    "# HELP treeline_requests_total Total HTTP requests seen\n"
                    "# TYPE treeline_requests_total counter\n"
                    f"treeline_requests_total {metrics['requests_total']}\n"
                    "# HELP treeline_blocked_total Total blocked requests\n"
                    "# TYPE treeline_blocked_total counter\n"
                    f"treeline_blocked_total {metrics['blocked_total']}\n"
                    "# HELP treeline_redacted_total Total responses redacted\n"
                    "# TYPE treeline_redacted_total counter\n"
                    f"treeline_redacted_total {metrics['redacted_total']}\n"
                ).encode()
            self.send_response(200); self.end_headers(); self.wfile.write(body); return
        if self.path == "/policy/summary":
            with _lock:
                body = json.dumps({
                    "block": [r.pattern for r in _block_patterns],
                    "redact": [r.pattern for r in _redact_patterns],
                }).encode()
            self.send_response(200); self.end_headers(); self.wfile.write(body); return
        self.send_response(404); self.end_headers()

def _serve():
    try:
        srv = HTTPServer(("0.0.0.0", METRICS_PORT), _Handler)
    except OSError:
        ctx.log.warn(f"[addon] metrics port :{METRICS_PORT} already in use; keeping existing server")
        return
    ctx.log.info(f"[addon] metrics on :{METRICS_PORT}")
    srv.serve_forever()

def load(loader):
    global _metrics_started, _reloader_started, _block_patterns, _redact_patterns
    with _lock:
        _block_patterns, _redact_patterns = _load_rules()
    if not _reloader_started:
        threading.Thread(target=_reloader, daemon=True).start()
        _reloader_started = True
    if not _metrics_started:
        threading.Thread(target=_serve, daemon=True).start()
        _metrics_started = True

def _search_any(rx_list, text):
    for r in rx_list:
        if r.search(text):
            return True
    return False

def request(flow: http.HTTPFlow):
    with _lock:
        metrics["requests_total"] += 1
        block_res = list(_block_patterns)
    try:
        body = flow.request.get_text("", "replace")
    except Exception:
        body = ""
    headers = "\n".join(f"{k}: {v}" for k, v in flow.request.headers.items())
    if _search_any(block_res, body) or _search_any(block_res, headers):
        with _lock:
            metrics["blocked_total"] += 1
        ctx.log.warn(f"[BLOCK] {flow.request.method} {flow.request.host}{flow.request.path}")
        flow.response = http.Response.make(
            451,
            b"Blocked by Treeline policy (secret/PII detected).",
            {"Content-Type": "text/plain", "X-Treeline-Action": "blocked"},
        )

def response(flow: http.HTTPFlow):
    # decode → apply regex → set_text
    try:
        raw = flow.response.get_content() or b""
    except Exception:
        return
    ctype = flow.response.headers.get("content-type", "")
    enc = "utf-8"
    if "charset=" in ctype:
        enc = ctype.split("charset=", 1)[1].split(";", 1)[0].strip() or "utf-8"
    try:
        text = raw.decode(enc, errors="replace")
    except Exception:
        text = raw.decode("utf-8", errors="replace")

    with _lock:
        redact_res = list(_redact_patterns)

    redacted = text
    for r in redact_res:
        redacted = r.sub("[REDACTED]", redacted)

    if redacted != text:
        flow.response.set_text(redacted)
        flow.response.headers["X-Treeline-Action"] = "redacted"
        with _lock:
            metrics["redacted_total"] += 1
