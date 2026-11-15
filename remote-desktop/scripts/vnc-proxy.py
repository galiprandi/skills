#!/usr/bin/env python3
"""HTTP/WebSocket proxy: public :6099 -> KasmVNC https://127.0.0.1:6901.

KasmVNC runs sslOnly and requires HTTP Basic auth (kasm_user:$VNC_PW) plus a
Sec-WebSocket-Origin header. This proxy terminates plain HTTP, injects those
credentials/headers, and passes the native KasmVNC web UI + websocket through.

Env:
  PROXY_PORT   listen port (default 6099)
  PROXY_CREDS  "user:password" injected as Basic auth (default: kasm_user:$VNC_PW)
"""
import base64
import hashlib
import http.server
import os
import select
import socket
import ssl
import sys
import urllib.error
import urllib.request

LISTEN = int(os.environ.get("PROXY_PORT", "6099"))
TH, TP = "127.0.0.1", 6901
CREDS = os.environ.get(
    "PROXY_CREDS", "kasm_user:" + os.environ.get("VNC_PW", ""))
TOKEN = base64.b64encode(CREDS.encode()).decode()

_ctx = ssl.create_default_context()
_ctx.check_hostname = False
_ctx.verify_mode = ssl.CERT_NONE

AUTOCONNECT_SNIPPET = """<script>
window.addEventListener('load', function () {
  setTimeout(function () {
    try {
      var p = document.getElementById('noVNC_password_input');
      if (p) { p.value = '__PW__'; p.dispatchEvent(new Event('input', {bubbles:true})); }
      var s = document.querySelector('input[name="password"]');
      if (s) { s.value = '__PW__'; }
      var b = document.getElementById('noVNC_connect_button');
      if (b) b.click();
    } catch (e) { console.warn(e); }
  }, 400);
});
</script>"""


class H(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *a):
        sys.stderr.write("[vnc-proxy] " + (fmt % a) + "\n")

    def _upstream(self, path):
        hdrs = {k: v for k, v in self.headers.items()
                if k.lower() not in ("host", "authorization", "connection",
                                     "upgrade", "sec-websocket-key",
                                     "sec-websocket-version",
                                     "sec-websocket-protocol",
                                     "sec-websocket-origin")}
        hdrs["Authorization"] = "Basic " + TOKEN
        req = urllib.request.Request(f"https://{TH}:{TP}{path}", headers=hdrs,
                                     method=self.command)
        return urllib.request.urlopen(req, context=_ctx, timeout=30)

    def do_GET(self):
        if self.headers.get("Upgrade", "").lower() == "websocket":
            return self._ws()
        if self.path in ("/", "/index.html", "/vnc.html"):
            return self._html("/index.html")
        return self._static(self.path)

    do_POST = do_PUT = do_DELETE = do_HEAD = do_OPTIONS = do_GET

    def _static(self, path):
        try:
            r = self._upstream(path)
            body = r.read()
            self.send_response(r.status)
            self.send_header("Content-Type",
                             r.headers.get("Content-Type", "application/octet-stream"))
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(body)
        except urllib.error.HTTPError as e:
            b = e.read()
            self.send_response(e.code)
            self.send_header("Content-Length", str(len(b)))
            self.end_headers()
            self.wfile.write(b)
        except Exception as e:
            self.log_message("err %s", e)
            self.send_error(502)

    def _html(self, path):
        try:
            r = self._upstream(path)
            html = r.read().decode("utf-8", "replace")
            pw = CREDS.split(":", 1)[1] if ":" in CREDS else ""
            html = html.replace("</body>",
                                AUTOCONNECT_SNIPPET.replace("__PW__", pw)
                                + "</body>", 1)
            body = html.encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(body)
        except Exception as e:
            self.log_message("html err %s", e)
            self.send_error(502)

    def _ws(self):
        up = _ctx.wrap_socket(socket.create_connection((TH, TP), timeout=15),
                              server_hostname=TH)
        key = self.headers.get("Sec-WebSocket-Key", "")
        origin = f"https://{TH}:{TP}"
        proto = self.headers.get("Sec-WebSocket-Protocol", "binary")
        up.sendall(
            (f"GET {self.path} HTTP/1.1\r\nHost: {TH}:{TP}\r\n"
             "Upgrade: websocket\r\nConnection: Upgrade\r\n"
             f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n"
             f"Sec-WebSocket-Protocol: {proto}\r\n"
             f"Sec-WebSocket-Origin: {origin}\r\nOrigin: {origin}\r\n"
             f"Authorization: Basic {TOKEN}\r\n\r\n").encode())
        resp = b""
        while b"\r\n\r\n" not in resp:
            c = up.recv(4096)
            if not c:
                return self.send_error(502)
            resp += c
        head, _, rest = resp.partition(b"\r\n\r\n")
        if b"101" not in head.split(b"\r\n")[0]:
            return self.send_error(502)
        accept = base64.b64encode(hashlib.sha1(
            (key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").encode()).digest()).decode()
        self.wfile.write(
            b"HTTP/1.1 101 Switching Protocols\r\n"
            b"Upgrade: websocket\r\nConnection: Upgrade\r\n"
            + f"Sec-WebSocket-Accept: {accept}\r\n".encode()
            + f"Sec-WebSocket-Protocol: {proto}\r\n\r\n".encode())
        self.wfile.flush()
        if rest:
            self.wfile.write(rest)
            self.wfile.flush()
        try:
            while True:
                r, _, _ = select.select([self.connection, up], [], [], 300)
                if not r:
                    continue
                if self.connection in r:
                    d = self.connection.recv(65536)
                    if not d:
                        break
                    up.sendall(d)
                if up in r:
                    d = up.recv(65536)
                    if not d:
                        break
                    self.connection.sendall(d)
        except Exception:
            pass
        finally:
            try:
                up.close()
            except Exception:
                pass
            self.close_connection = True


if __name__ == "__main__":
    if not CREDS.endswith(":") and CREDS.count(":") != 1:
        print("[vnc-proxy] FATAL: PROXY_CREDS/VNC_PW missing", file=sys.stderr)
        sys.exit(1)
    s = http.server.ThreadingHTTPServer(("127.0.0.1", LISTEN), H)
    s.daemon_threads = True
    print(f"[vnc-proxy] :{LISTEN} -> https://{TH}:{TP}", flush=True)
    s.serve_forever()
