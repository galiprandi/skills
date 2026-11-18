#!/usr/bin/env node
/**
 * HTTP/WebSocket proxy: public :6099 -> KasmVNC https://127.0.0.1:6901
 *
 * KasmVNC runs sslOnly and requires HTTP Basic auth (kasm_user:$VNC_PW) plus a
 * Sec-WebSocket-Origin header. This proxy terminates plain HTTP, injects those
 * credentials/headers, and passes the native KasmVNC web UI + websocket through.
 *
 * Optional OTP gate: when POD_VNC_OTP is set, a browser must prove it holds the
 * one-time code before the proxy injects the KasmVNC credentials. The WebSocket
 * upgrade is gated too — the session cookie is required there as well, so the
 * WS path cannot be used to skip the code.
 *
 * Zero dependencies: only Node >= 20 built-ins (http, https, net, crypto).
 *
 * Env:
 *   PROXY_PORT          listen port (default 6099)
 *   PROXY_CREDS         "user:password" injected as Basic auth
 *   POD_VNC_OTP         optional 6-digit one-time code; empty = disabled
 *   POD_VNC_OTP_TTL     seconds the code stays valid (default 300)
 *   POD_VNC_OTP_TRIES   max wrong attempts per IP (default 3)
 *   POD_VNC_SESSION_TTL seconds a session cookie stays valid (default 43200)
 */

import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import crypto from 'node:crypto';

const LISTEN = Number(process.env.PROXY_PORT || 6099);
const TH = '127.0.0.1';
const TP = 6901;

const CREDS = process.env.PROXY_CREDS || `kasm_user:${process.env.VNC_PW || ''}`;
const TOKEN = Buffer.from(CREDS, 'utf8').toString('base64');

const OTP = (process.env.POD_VNC_OTP || '').trim();
const OTP_TTL = Number(process.env.POD_VNC_OTP_TTL || 300);
const OTP_MAX_TRIES = Number(process.env.POD_VNC_OTP_TRIES || 3);
const SESSION_TTL = Number(process.env.POD_VNC_SESSION_TTL || 12 * 3600);
const COOKIE = 'podvnc_sess';

/** @type {Map<string, number>} session id -> expiry (epoch seconds) */
const sessions = new Map();
/** @type {Map<string, {n: number, start: number}>} ip -> attempt window */
const tries = new Map();

const TLS_AGENT = new https.Agent({ rejectUnauthorized: false, keepAlive: true });

// ── helpers ────────────────────────────────────────────────────────────────

const now = () => Math.floor(Date.now() / 1000);

function sessionValid(sid) {
  if (!sid) return false;
  const exp = sessions.get(sid);
  if (!exp) return false;
  if (exp < now()) {
    sessions.delete(sid);
    return false;
  }
  return true;
}

function newSession() {
  const sid = crypto.randomBytes(32).toString('base64url');
  sessions.set(sid, now() + SESSION_TTL);
  return sid;
}

function sweeper() {
  // Drop expired sessions/attempt windows so the maps cannot grow unbounded.
  const t = now();
  for (const [sid, exp] of sessions) if (exp < t) sessions.delete(sid);
  for (const [ip, w] of tries) if (t - w.start > OTP_TTL) tries.delete(ip);
}
setInterval(sweeper, 60_000).unref();

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

function clientIp(req) {
  const cf = req.headers['cf-connecting-ip'];
  const real = req.headers['x-forwarded-for'];
  const raw = (Array.isArray(cf) ? cf[0] : cf) || (Array.isArray(real) ? real[0] : real) ||
    req.socket.remoteAddress || '?';
  return String(raw).split(',')[0].trim();
}

function authorized(req) {
  if (!OTP) return true;
  return sessionValid(parseCookies(req.headers.cookie || '')[COOKIE]);
}

function loginPage(err = '', status = 401, res) {
  const body = LOGIN_PAGE.replace(
    '__ERR__',
    err ? `<div class="err">${escapeHtml(err)}</div>` : '',
  );
  res.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    'referrer-policy': 'no-referrer',
  });
  res.end(body);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function attemptsExceeded(ip) {
  const t = now();
  let w = tries.get(ip);
  if (!w || t - w.start > OTP_TTL) {
    w = { n: 0, start: t };
    tries.set(ip, w);
  }
  return w.n >= OTP_MAX_TRIES;
}

function bumpAttempts(ip) {
  const t = now();
  let w = tries.get(ip);
  if (!w || t - w.start > OTP_TTL) w = { n: 0, start: t };
  w.n += 1;
  tries.set(ip, w);
  return w.n;
}

/** Strip hop-by-hop headers, inject KasmVNC auth, forward upstream. */
function upstreamHeaders(req, extra = {}) {
  const drop = new Set([
    'host', 'authorization', 'connection', 'upgrade', 'keep-alive',
    'proxy-connection', 'transfer-encoding', 'te', 'trailer',
    'sec-websocket-key', 'sec-websocket-version', 'sec-websocket-extensions',
    'sec-websocket-protocol', 'sec-websocket-origin',
  ]);
  const out = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (!drop.has(k)) out[k] = v;
  }
  out.authorization = `Basic ${TOKEN}`;
  return Object.assign(out, extra);
}

function upstreamRequest(req, res, upstreamPath) {
  const opts = {
    host: TH,
    port: TP,
    method: req.method,
    path: upstreamPath,
    headers: upstreamHeaders(req, { host: `${TH}:${TP}` }),
    rejectUnauthorized: false,
    agent: TLS_AGENT,
    timeout: 30_000,
  };
  const up = https.request(opts, (ur) => {
    const ct = ur.headers['content-type'] || 'application/octet-stream';
    // Only inject into a *successful* HTML document. Upstream errors (401 from
    // KasmVNC, 502, redirects) must pass through untouched — rewriting them
    // would hide the real failure behind the proxy.
    const isHtml = /text\/html/i.test(ct) && (ur.statusCode || 0) === 200;
    if (!isHtml) {
      res.writeHead(ur.statusCode || 502, {
        'content-type': ct,
        'cache-control': 'no-cache',
      });
      ur.pipe(res);
      return;
    }
    // Injected HTML: mobile defaults + autoconnect.
    const chunks = [];
    ur.on('data', (c) => chunks.push(c));
    ur.on('end', () => {
      let html = Buffer.concat(chunks).toString('utf8');
      html = html.replace('</head>', `${MOBILE_SNIPPET}</head>`);
      // NOTE: the KasmVNC password is never embedded here. The proxy injects
      // Basic auth upstream, so the browser never needs it.
      html = html.replace('</body>', `${AUTOCONNECT_SNIPPET}</body>`);
      const body = Buffer.from(html, 'utf8');
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'content-length': body.length,
        'cache-control': 'no-store',
      });
      res.end(body);
    });
  });
  up.on('timeout', () => up.destroy(new Error('upstream timeout')));
  up.on('error', (e) => {
    log('upstream error:', e.message);
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' });
    res.end('upstream error');
  });
  if (req.method === 'GET' || req.method === 'HEAD') {
    up.end();
  } else {
    req.pipe(up);
  }
}

function log(...a) {
  process.stderr.write(`[vnc-proxy] ${a.join(' ')}\n`);
}

// ── WebSocket tunnel (gated) ───────────────────────────────────────────────

function tunnelWebSocket(req, socket, head) {
  if (!authorized(req)) {
    log('ws rejected: no session', clientIp(req));
    socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
    return;
  }

  const key = req.headers['sec-websocket-key'];
  const proto = req.headers['sec-websocket-protocol'] || 'binary';
  const origin = `https://${TH}:${TP}`;

  // KasmVNC listens with sslOnly — the upgrade must go over TLS.
  const up = tls.connect({
    host: TH,
    port: TP,
    rejectUnauthorized: false,
    servername: 'localhost',
  });
  up.setTimeout(0);

  up.on('connect', () => {
    const reqLine = [
      `GET ${req.url} HTTP/1.1`,
      `Host: ${TH}:${TP}`,
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Key: ${key}`,
      'Sec-WebSocket-Version: 13',
      `Sec-WebSocket-Protocol: ${proto}`,
      `Sec-WebSocket-Origin: ${origin}`,
      `Origin: ${origin}`,
      `Authorization: Basic ${TOKEN}`,
    ].join('\r\n');
    up.write(`${reqLine}\r\n\r\n`);
  });

  let handshaken = false;
  let buf = Buffer.alloc(0);

  const onUpstreamData = (chunk) => {
    if (handshaken) return; // pipe() ya toma el control del stream
    buf = Buffer.concat([buf, chunk]);
    const idx = buf.indexOf('\r\n\r\n');
    if (idx < 0) return;
    const headText = buf.subarray(0, idx).toString('latin1');
    const rest = buf.subarray(idx + 4);
    if (!/^HTTP\/1\.1 101/i.test(headText)) {
      log('ws upstream refused:', headText.split('\r\n')[0]);
      socket.end('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n');
      up.destroy();
      return;
    }
    const accept = crypto
      .createHash('sha1')
      .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest('base64');
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n` +
      `Sec-WebSocket-Protocol: ${proto}\r\n\r\n`,
    );
    if (rest.length) socket.write(rest);
    handshaken = true;
    // Quitar el listener ANTES de pipear: si queda, cada chunk upstream se
    // escribe dos veces al cliente (listener + pipe) y el stream RFB se
    // desincroniza — el browser quedaba en "connecting…" eterno.
    up.removeListener('data', onUpstreamData);
    socket.pipe(up);
    up.pipe(socket);
  };

  up.on('data', onUpstreamData);
  up.on('error', (e) => {
    log('ws error:', e.message);
    if (!socket.destroyed) socket.destroy();
  });
  up.on('close', () => {
    if (!socket.destroyed) socket.destroy();
  });
  socket.on('error', () => up.destroy());
  socket.on('close', () => up.destroy());
  if (head && head.length && !up.destroyed) up.write(head);
}

// ── HTTP server ────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  const url = req.url || '/';
  const path = url.split('?')[0];

  // Login submission
  if (req.method === 'POST' && path === '/otp' && OTP) {
    const ip = clientIp(req);
    if (attemptsExceeded(ip)) {
      return loginPage('Demasiados intentos. Espera unos minutos.', 429, res);
    }
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 4096) return req.destroy();
      chunks.push(c);
    });
    req.on('end', () => {
      const form = new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
      const got = String(form.get('otp') || '').replace(/\D/g, '');
      const a = Buffer.from(got.padEnd(8, ' '));
      const b = Buffer.from(OTP.padEnd(8, ' '));
      const ok = got.length === OTP.length && a.length === b.length &&
        crypto.timingSafeEqual(a, b);
      if (ok) {
        const sid = newSession();
        res.writeHead(303, {
          location: '/vnc.html',
          'set-cookie': `${COOKIE}=${sid}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL}`,
          'content-length': 0,
        });
        res.end();
        log('otp ok ip=', ip);
        return;
      }
      const n = bumpAttempts(ip);
      if (n >= OTP_MAX_TRIES) log('otp lockout ip=', ip);
      loginPage('Código incorrecto.', 401, res);
    });
    return;
  }

  // Liveness probe — served before the gate so `pod-vnc start` can wait on it
  // whether or not OTP is enabled.
  if (path === '/healthz') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    return res.end('ok\n');
  }

  // Everything else requires a session when OTP is enabled
  if (!authorized(req)) {
    return loginPage('', 401, res);
  }

  if (path === '/logout') {
    const sid = parseCookies(req.headers.cookie || '')[COOKIE];
    if (sid) sessions.delete(sid);
    res.writeHead(303, {
      location: '/',
      'set-cookie': `${COOKIE}=; Path=/; Max-Age=0`,
      'content-length': 0,
    });
    return res.end();
  }

  if (path === '/' || path === '/index.html' || path === '/vnc.html') {
    return upstreamRequest(req, res, '/index.html');
  }

  return upstreamRequest(req, res, url);
});

server.on('upgrade', (req, socket, head) => tunnelWebSocket(req, socket, head));

// ── startup validation ─────────────────────────────────────────────────────

if (!CREDS.includes(':') || CREDS.endsWith(':')) {
  console.error('[vnc-proxy] FATAL: PROXY_CREDS/VNC_PW missing');
  process.exit(1);
}
if (OTP && !/^\d{6}$/.test(OTP)) {
  console.error('[vnc-proxy] FATAL: POD_VNC_OTP must be 6 digits');
  process.exit(1);
}

server.listen(LISTEN, '127.0.0.1', () => {
  log(`:${LISTEN} -> https://${TH}:${TP} (otp: ${OTP ? 'on' : 'off'})`);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    log('shutting down');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1000).unref();
  });
}

// ── injected snippets ──────────────────────────────────────────────────────

const MOBILE_SNIPPET = `<script>
(function(){
  try{
    var m=document.querySelector('meta[name=viewport]');
    if(!m){m=document.createElement('meta');m.name='viewport';document.head.appendChild(m);}
    m.setAttribute('content','width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover');
    if(/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)){
      try{ localStorage.setItem('vnc_setting_resize','scale');
           localStorage.setItem('vnc_setting_virtual_keyboard_visible','true');
           localStorage.setItem('vnc_setting_enable_ime','true'); }catch(e){}
    }
  }catch(e){}
})();
</script>`;

const AUTOCONNECT_SNIPPET = `<script>
window.addEventListener('load', function () {
  setTimeout(function () {
    try {
      var b = document.getElementById('noVNC_connect_button');
      if (b) b.click();
    } catch (e) { console.warn(e); }
  }, 400);
});
</script>`;

const LOGIN_PAGE = `<!DOCTYPE html><html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Acceso: código</title><style>
*{box-sizing:border-box;margin:0}
body{min-height:100dvh;display:flex;align-items:center;justify-content:center;background:#0b0b0c;color:#eee;
 font-family:system-ui,-apple-system,sans-serif;padding:24px}
.card{width:100%;max-width:380px;background:#151517;border:1px solid #2a2a30;border-radius:16px;padding:24px}
h1{font-size:19px;margin-bottom:6px}
p{font-size:13px;opacity:.65;margin-bottom:18px;line-height:1.45}
input{width:100%;font-size:26px;letter-spacing:.45em;text-align:center;padding:14px;border-radius:11px;
 border:1px solid #3a3a42;background:#0d0d10;color:#eee;outline:none;font-variant-numeric:tabular-nums}
input:focus{border-color:#3b82f6}
button{width:100%;margin-top:12px;padding:15px;font-size:16px;font-weight:600;border:0;border-radius:11px;
 background:#2563eb;color:#fff}
button:active{background:#1d4ed8}
.err{margin-top:12px;font-size:13px;color:#f87171;text-align:center}
</style></head><body><form class="card" method="POST" action="/otp">
<h1>Acceso al escritorio</h1>
<p>Ingresa el código de 6 dígitos que te envió tu asistente.</p>
<input name="otp" inputmode="numeric" pattern="[0-9]*" maxlength="6" autofocus autocomplete="one-time-code" required>
<button type="submit">Entrar</button>
__ERR__
</form></body></html>`;
