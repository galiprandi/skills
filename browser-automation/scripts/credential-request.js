#!/usr/bin/env node
/**
 * credential-request.js — Temporary remote access to the repo browser so the
 * user can type credentials (or solve a login) from their phone/another device.
 *
 * What it does:
 *   1. Opens <url> in a new headed tab and closes the other tabs (unless
 *      --keep-tabs), so the remote viewer shows only the target site.
 *   2. Enables the agent-browser stream on a random localhost port.
 *   3. Starts a tiny HTTP+WebSocket server (random port) serving a minimal
 *      mobile-friendly viewer that proxies the stream (the stream only accepts
 *      localhost browser origins, so the page cannot connect to it directly).
 *   4. Exposes it through a cloudflared quick tunnel (ephemeral trycloudflare
 *      URL) and prints the link — send it to the user (e.g. via Telegram).
 *   5. After --ttl seconds (default 300) everything is torn down: tunnel killed,
 *      server stopped. The browser stays open with the logged-in session.
 *
 * Usage (from the repo root):
 *   node .agents/skills/browser-automation/scripts/credential-request.js <url> [--ttl <sec>] [--keep-tabs]
 *
 * Requires: agent-browser (global), cloudflared on PATH, Node >= 22 (global WebSocket).
 *
 * Env:
 *   BROWSER_DEBUG=1   Verbose logging to stderr.
 */
'use strict';

const { spawn, spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');

const REPO_ROOT = process.cwd();
const PROFILE_DIR = path.join(REPO_ROOT, '.browser-profile');
const CONFIG_PATH = path.join(REPO_ROOT, 'agent-browser.json');
const DEBUG = process.env.BROWSER_DEBUG === '1';
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function debug(msg) { if (DEBUG) console.error(`[cred-req:debug] ${msg}`); }
function fail(msg) { console.error(`[cred-req] ${msg}`); cleanup(1); }

// --- agent-browser env (mirrors browser.js) ---

function env() {
  const e = Object.assign({}, process.env);
  e.AGENT_BROWSER_CONFIG = e.AGENT_BROWSER_CONFIG || CONFIG_PATH;
  e.AGENT_BROWSER_ARGS = e.AGENT_BROWSER_ARGS || '--no-sandbox,--disable-blink-features=AutomationControlled';
  e.AGENT_BROWSER_PROFILE = e.AGENT_BROWSER_PROFILE || PROFILE_DIR;
  e.AGENT_BROWSER_NAMESPACE = e.AGENT_BROWSER_NAMESPACE || path.basename(REPO_ROOT);
  if (!e.AGENT_BROWSER_EXECUTABLE_PATH) {
    for (const p of ['/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium',
                     'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                     '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']) {
      if (fs.existsSync(p)) { e.AGENT_BROWSER_EXECUTABLE_PATH = p; break; }
    }
  }
  return e;
}

function abBin() {
  if (process.env.AGENT_BROWSER_BIN) return [process.env.AGENT_BROWSER_BIN];
  const local = path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'agent-browser.cmd' : 'agent-browser');
  if (fs.existsSync(local)) return [local];
  const probe = spawnSync('agent-browser', ['--version'], { encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'pipe'] });
  if (!probe.error) return ['agent-browser'];
  return process.platform === 'win32' ? ['cmd.exe', '/d', '/s', '/c', 'npx', '-y', 'agent-browser']
                                    : ['npx', '-y', 'agent-browser'];
}

function ab(args) {
  const [bin, ...binArgs] = abBin();
  const r = spawnSync(bin, [...binArgs, ...args], { env: env(), encoding: 'utf8', timeout: 30000 });
  if (r.error) fail(`agent-browser spawn failed: ${r.error.message}`);
  debug(`ab ${args.join(' ')} -> ${r.status}`);
  return { ok: r.status === 0, stdout: r.stdout || '', stderr: r.stderr || '' };
}

function abJson(args) {
  const r = ab([...args, '--json']);
  try { return JSON.parse(r.stdout); } catch { return null; }
}

// --- args ---

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--'));
const ttlIdx = args.indexOf('--ttl');
const TTL_SEC = ttlIdx >= 0 ? parseInt(args[ttlIdx + 1], 10) : 300;
const KEEP_TABS = args.includes('--keep-tabs');

if (!url || !/^https?:\/\//.test(url)) {
  console.error('Usage: credential-request.js <url> [--ttl <sec>] [--keep-tabs]');
  process.exit(1);
}
if (!Number.isFinite(TTL_SEC) || TTL_SEC < 0) {
  console.error('--ttl must be a non-negative number of seconds (0 = until Ctrl+C)');
  process.exit(1);
}

// --- state for cleanup ---

let server = null;
let tunnel = null;
let upstream = null;
let cleaned = false;

function cleanup(code = 0) {
  if (cleaned) return;
  cleaned = true;
  debug('cleanup');
  if (tunnel) { try { tunnel.kill('SIGTERM'); } catch {} }
  if (upstream) { try { upstream.close(); } catch {} }
  if (server) { try { server.close(); } catch {} }
  // Give cloudflared a moment to die, then force.
  setTimeout(() => { try { if (tunnel) tunnel.kill('SIGKILL'); } catch {} process.exit(code); }, 800).unref();
  setTimeout(() => process.exit(code), 3000).unref();
}

process.on('SIGINT', () => { console.error('\n[cred-req] interrupted — tearing down'); cleanup(0); });
process.on('SIGTERM', () => { console.error('\n[cred-req] terminated — tearing down'); cleanup(0); });

// --- port picker ---

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
  });
}

// --- minimal WebSocket server (RFC 6455, text/binary, ping/pong, fragmentation) ---

const WS_MAGIC = crypto.createHash('sha1').update(WS_GUID).digest();

function wsAccept(key) {
  return crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
}

function encodeFrame(opcode, payload) {
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  const len = data.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  header[0] = 0x80 | opcode;
  return Buffer.concat([header, data]);
}

// Parses buffered bytes into complete messages.
// Returns { messages: [{opcode, payload(Buffer)}], rest: Buffer }
function decodeFrames(buf) {
  const messages = [];
  let off = 0;
  while (buf.length - off >= 2) {
    const b0 = buf[off];
    const b1 = buf[off + 1];
    const fin = (b0 & 0x80) !== 0;
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f;
    let pos = off + 2;
    if (len === 126) {
      if (buf.length - pos < 2) break;
      len = buf.readUInt16BE(pos); pos += 2;
    } else if (len === 127) {
      if (buf.length - pos < 8) break;
      len = Number(buf.readBigUInt64BE(pos)); pos += 8;
    }
    const maskLen = masked ? 4 : 0;
    if (buf.length - pos < maskLen + len) break;
    let payload = buf.subarray(pos + maskLen, pos + maskLen + len);
    if (masked) {
      const mask = buf.subarray(pos, pos + 4);
      const unmasked = Buffer.alloc(len);
      for (let i = 0; i < len; i++) unmasked[i] = payload[i] ^ mask[i & 3];
      payload = unmasked;
    }
    off = pos + maskLen + len;
    if (opcode === 0x8) { messages.push({ opcode: 0x8, payload }); return { messages, rest: buf.subarray(off), closed: true }; }
    if (opcode === 0x9) { messages.push({ opcode: 0x9, payload }); continue; }
    if (opcode === 0xa) continue; // pong
    messages.push({ opcode, payload, fin });
  }
  return { messages, rest: buf.subarray(off) };
}

// Reassemble fragmented messages; returns complete {opcode, payload} list.
function reassemble(frames) {
  const out = [];
  let fragOp = 0;
  let fragParts = [];
  for (const f of frames) {
    if (f.opcode === 0x0) { fragParts.push(f.payload); if (f.fin) { out.push({ opcode: fragOp, payload: Buffer.concat(fragParts) }); fragParts = []; } continue; }
    if (!f.fin) { fragOp = f.opcode; fragParts = [f.payload]; continue; }
    out.push({ opcode: f.opcode, payload: f.payload });
  }
  return out;
}

// --- viewer page ---

function viewerHtml(token, streamPort, expiresAt) {
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>Acceso temporal</title>
<style>
  *{box-sizing:border-box;margin:0}
  html,body{height:100%;background:#000;color:#eee;font-family:system-ui,sans-serif;display:flex;flex-direction:column;overflow:hidden}
  #bar{display:flex;align-items:center;gap:8px;padding:6px 10px;background:#111;font-size:12px;flex-shrink:0}
  #dot{width:9px;height:9px;border-radius:50%;background:#f44}
  #dot.on{background:#4c4}
  #url{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:.7}
  #exp{opacity:.7;font-variant-numeric:tabular-nums}
  #kbdBtn{background:#333;border:0;color:#eee;border-radius:6px;padding:4px 10px;font-size:16px}
  #stage{flex:1;position:relative;display:flex;align-items:center;justify-content:center;background:#000;touch-action:none;overflow:hidden}
  #view{max-width:100%;max-height:100%;display:block;user-select:none;-webkit-user-select:none}
  #kbd{display:none;padding:8px;background:#1a1a1a;flex-shrink:0}
  #kbd.open{display:block}
  #typebox{width:100%;padding:10px;font-size:16px;border-radius:8px;border:1px solid #444;background:#0d0d0d;color:#eee}
  #hint{font-size:11px;opacity:.5;padding:4px 2px}
</style></head><body>
<div id="bar"><span id="dot"></span><span id="url">conectando…</span><span id="exp"></span><button id="kbdBtn">⌨</button></div>
<div id="stage"><img id="view" alt=""></div>
<div id="kbd"><input id="typebox" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="Tocá un campo del navegador y escribí acá"><div id="hint">Los caracteres se escriben en el campo que tocaste. Enter = Enter remoto. Las teclas Backspace/Delete funcionan.</div></div>
<script>
const K=${JSON.stringify(token)};
const EXPIRES=${expiresAt};
const img=document.getElementById('view'),stage=document.getElementById('stage'),
      dot=document.getElementById('dot'),urlEl=document.getElementById('url'),expEl=document.getElementById('exp'),
      kbd=document.getElementById('kbd'),typebox=document.getElementById('typebox');
document.getElementById('kbdBtn').onclick=()=>kbd.classList.toggle('open');
let ws=null,vw=0,vh=0,seq=0;
function send(o){if(ws&&ws.readyState===1)ws.send(JSON.stringify(o));}
function scale(e){const r=img.getBoundingClientRect();
  const fx=(e.clientX-r.left)/r.width, fy=(e.clientY-r.top)/r.height;
  return {x:Math.round(fx*vw),y:Math.round(fy*vh)};}
function mod(m){let v=0;if(m.altKey)v|=1;if(m.ctrlKey)v|=2;if(m.metaKey)v|=4;if(m.shiftKey)v|=8;return v;}
const VK={Enter:13,Backspace:8,Tab:9,Escape:27,Delete:46,Home:36,End:35,PageUp:33,PageDown:34,' ':32,
  ArrowLeft:37,ArrowUp:38,ArrowRight:39,ArrowDown:40};
function keyPayload(key,code,text,evt){return{type:'input_keyboard',eventType:'keyDown',key,code:code||'',
  text:text||'',windowsVirtualKeyCode:VK[key]||(key&&key.length===1?key.toUpperCase().charCodeAt(0):0),
  modifiers:mod(evt||{})};}
function sendChar(ch){send(keyPayload(ch,'',ch,{}));send({...keyPayload(ch,'',ch,{}),eventType:'keyUp'});}
function sendSpecial(key){const p=keyPayload(key,'','',{});send(p);send({...p,eventType:'keyUp'});}
// pointer → mouse
const pts=new Map();let lastMove=0;
stage.addEventListener('pointerdown',e=>{stage.setPointerCapture(e.pointerId);pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
  const p=scale(e);send({type:'input_mouse',eventType:'mousePressed',x:p.x,y:p.y,button:'left',clickCount:1,modifiers:0});e.preventDefault();});
stage.addEventListener('pointerup',e=>{pts.delete(e.pointerId);
  const p=scale(e);send({type:'input_mouse',eventType:'mouseReleased',x:p.x,y:p.y,button:'left',clickCount:1,modifiers:0});});
stage.addEventListener('pointermove',e=>{if(!pts.has(e.pointerId))return;pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
  const now=Date.now();if(now-lastMove<50)return;lastMove=now;
  if(pts.size>=2){const a=[...pts.values()];send({type:'input_mouse',eventType:'mouseWheel',x:0,y:0,button:'none',clickCount:0,deltaX:0,deltaY:(a[0].y-a[1].y)*3,modifiers:0});return;}
  const p=scale(e);send({type:'input_mouse',eventType:'mouseMoved',x:p.x,y:p.y,button:'none',clickCount:0,modifiers:0});});
stage.addEventListener('wheel',e=>{e.preventDefault();const p=scale(e);
  send({type:'input_mouse',eventType:'mouseWheel',x:p.x,y:p.y,button:'none',clickCount:0,deltaX:-e.deltaX,deltaY:e.deltaY,modifiers:0});},{passive:false});
// typing box → remote keystrokes (beforeinput covers mobile keyboards/IME)
let composing=false;
typebox.addEventListener('compositionstart',()=>{composing=true;});
typebox.addEventListener('compositionend',e=>{composing=false;
  for(const ch of (e.data||''))sendChar(ch);typebox.value='';});
typebox.addEventListener('beforeinput',e=>{
  if(composing)return;
  if(e.inputType==='insertText'&&e.data){for(const ch of e.data)sendChar(ch);e.preventDefault();}
  else if(e.inputType==='deleteContentBackward'){sendSpecial('Backspace');e.preventDefault();}
  else if(e.inputType==='deleteContentForward'){sendSpecial('Delete');e.preventDefault();}
});
typebox.addEventListener('input',()=>{typebox.value='';});
typebox.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();sendSpecial('Enter');typebox.blur();kbd.classList.remove('open');}});
// physical keyboard (desktop)
window.addEventListener('keydown',e=>{if(document.activeElement===typebox)return;e.preventDefault();
  const p=keyPayload(e.key,e.code,e.key.length===1?e.key:'',e);send(p);send({...p,eventType:'keyUp'});});
window.addEventListener('keyup',e=>{if(document.activeElement===typebox)return;});
// ws
function connect(){
  ws=new WebSocket(location.origin.replace(/^http/,'ws')+'/ws?k='+encodeURIComponent(K)+'&pacing=ack&maxFps=8');
  ws.onopen=()=>{dot.classList.add('on');send({type:'config',pacing:'ack',maxFps:8});};
  ws.onclose=()=>{dot.classList.remove('on');urlEl.textContent='desconectado — recargá para reintentar';setTimeout(connect,2000);};
  ws.onmessage=ev=>{const m=JSON.parse(ev.data);
    if(m.type==='frame'){img.src='data:image/jpeg;base64,'+m.data;seq=m.seq;
      img.onload=()=>send({type:'ack',seq});}
    else if(m.type==='url'){urlEl.textContent=m.url||m.data||'';}
    else if(m.type==='status'&&m.url){urlEl.textContent=m.url;}
    else if(m.type==='tabs'&&m.tabs&&m.tabs.activeUrl){urlEl.textContent=m.tabs.activeUrl;}
  };
}
connect();
const iv=setInterval(()=>{const s=Math.max(0,Math.round((EXPIRES-Date.now())/1000));
  expEl.textContent=s>0?'⏱ '+Math.floor(s/60)+':'+String(s%60).padStart(2,'0'):'⏱ vencido';
  if(s<=0)clearInterval(iv);},1000);
</script></body></html>`;
}

// --- main ---

(async () => {
  // 1. Browser: new tab with the target URL, other tabs closed.
  // NOTE: never call `open` when the browser is already running — it relaunches
  // and wipes every tab. `tab new` reuses the live session; only fall back to
  // `open --headed` when no browser/daemon exists yet.
  debug('opening target tab');
  let tabRes = abJson(['tab', 'new', url]);
  if (!tabRes || tabRes.success === false) {
    debug('tab new failed — launching headed browser');
    ab(['open', '--headed']);
    tabRes = abJson(['tab', 'new', url]);
    if (!tabRes || tabRes.success === false) fail('could not open target URL in browser');
  }
  const targetTab = tabRes.data && tabRes.data.tabId;
  debug(`target tab: ${targetTab}`);

  if (!KEEP_TABS) {
    const list = abJson(['tab']);
    const tabs = list && list.data && list.data.tabs ? list.data.tabs : [];
    for (const t of tabs) {
      if (t.tabId === targetTab) continue;
      if (t.type && t.type !== 'page') continue;
      debug(`closing tab ${t.tabId} ${t.url}`);
      ab(['tab', 'close', t.tabId]);
    }
  }

  // Tracker blocklist (same origins as browser.js).
  const BLOCKED = ['doubleclick.net','google-analytics.com','googletagmanager.com','facebook.com',
    'connect.facebook.net','ads.linkedin.com','px.ads.linkedin.com','snap.licdn.com',
    'googleads.g.doubleclick.net','amazon-adsystem.com','criteo.com','taboola.com','outbrain.com',
    'scorecardresearch.com','quantserve.com','hotjar.com','mixpanel.com','segment.io','amplitude.com'];
  const routes = BLOCKED.map((o) => ['network', 'route', `*://*.${o}/*`, '--abort']);
  {
    const [bin, ...ba] = abBin();
    spawnSync(bin, [...ba, 'batch', '--json'], { env: env(), encoding: 'utf8', input: JSON.stringify(routes), timeout: 30000 });
  }

  // 2. Stream on a random port.
  const streamPort = await freePort();
  ab(['stream', 'disable']);
  const en = ab(['stream', 'enable', '--port', String(streamPort)]);
  if (!en.ok) fail('stream enable failed');
  debug(`stream on ${streamPort}`);

  // 3. HTTP + WS server on a random port.
  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = Date.now() + (TTL_SEC || 24 * 3600) * 1000;
  const html = viewerHtml(token, streamPort, expiresAt);
  const clients = new Set();

  // Latest message per type — replayed to each new viewer so clients that
  // connect after upstream attach still get status/tabs/url/current frame.
  const latest = {};
  function connectUpstream() {
    // Push pacing (default): the stream server holds only the newest frame per
    // client, so our single upstream connection always has the latest frame.
    // Ack pacing is filtered out in the bridge — viewers' acks must never
    // reach the stream or it would stall waiting for them.
    upstream = new WebSocket(`ws://127.0.0.1:${streamPort}/?maxFps=8`);
    upstream.onopen = () => debug('upstream ws open');
    upstream.onmessage = (ev) => {
      const data = typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString('utf8');
      try { const t = JSON.parse(data).type; if (t) latest[t] = data; } catch {}
      if (!connectUpstream._n) connectUpstream._n = 0;
      if (++connectUpstream._n % 50 === 1) debug(`upstream msgs: ${connectUpstream._n}`);
      const frame = encodeFrame(0x1, data);
      for (const c of clients) { try { c.write(frame); } catch {} }
    };
    upstream.onclose = () => {
      for (const c of clients) { try { c.end(); } catch {} } clients.clear();
      if (!cleaned) setTimeout(connectUpstream, 1500);
    };
    upstream.onerror = (e) => debug(`upstream ws error: ${e.message || e}`);
  }
  connectUpstream();

  server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/' && u.searchParams.get('k') === token) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(html);
    } else {
      res.writeHead(404); res.end('not found');
    }
  });

  server.on('upgrade', (req, socket, head) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname !== '/ws' || u.searchParams.get('k') !== token) { socket.destroy(); return; }
    const key = req.headers['sec-websocket-key'];
    if (!key) { socket.destroy(); return; }
    socket.write('HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${wsAccept(key)}\r\n\r\n`);
    clients.add(socket);
    // Replay latest state so the viewer renders immediately.
    for (const t of ['status', 'tabs', 'url', 'frame']) {
      if (latest[t]) { try { socket.write(encodeFrame(0x1, latest[t])); } catch {} }
    }
    socket.on('close', () => clients.delete(socket));
    socket.on('error', () => clients.delete(socket));

    let buf = Buffer.alloc(0);
    let fragOp = 0, fragParts = [];
    socket.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      const { messages, rest, closed } = decodeFrames(buf);
      buf = rest;
      if (closed) { try { upstream.close(); } catch {} socket.end(); return; }
      for (const m of reassemble(messages)) {
        if (m.opcode === 0x9) { socket.write(encodeFrame(0xA, m.payload)); continue; }
        if (m.opcode === 0x1 || m.opcode === 0x2) {
          let text;
          try { text = m.payload.toString('utf8'); } catch { continue; }
          let msg;
          try { msg = JSON.parse(text); } catch { msg = null; }
          if (msg && msg.type === 'ack') continue; // never ack the stream
          if (msg && msg.type === 'config') {
            // Forward only maxFps; strip pacing so viewers can't stall upstream.
            text = JSON.stringify({ type: 'config', maxFps: Math.min(Math.max(parseInt(msg.maxFps, 10) || 8, 1), 30) });
          }
          try { upstream.send(text); } catch (e) { debug(`upstream send: ${e.message}`); }
        }
      }
    });
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const webPort = server.address().port;
  debug(`viewer on 127.0.0.1:${webPort}`);

  // 4. Cloudflare quick tunnel.
  tunnel = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${webPort}`, '--no-autoupdate'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const publicUrl = await new Promise((resolve, reject) => {
    let out = '';
    const to = setTimeout(() => reject(new Error('cloudflared did not print a URL within 25s')), 25000);
    const onErr = (e) => { clearTimeout(to); reject(new Error(`cloudflared: ${e.message}`)); };
    const onData = (d) => {
      out += d.toString();
      debug(`cloudflared: ${d.toString().trim().slice(0, 200)}`);
      const m = out.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (m) { clearTimeout(to); resolve(m[0]); }
    };
    tunnel.stdout.on('data', onData);
    tunnel.stderr.on('data', onData);
    tunnel.on('error', onErr);
    tunnel.on('exit', (c) => { clearTimeout(to); reject(new Error(`cloudflared exited (${c})`)); });
  });

  const link = `${publicUrl}/?k=${token}`;
  console.log('\n🔐 Credential access ready');
  console.log(`   URL: ${url}`);
  console.log(`   Link (send to user): ${link}`);
  console.log(`   TTL: ${TTL_SEC === 0 ? 'until Ctrl+C' : TTL_SEC + 's'} — then tunnel+viewer die automatically. Browser stays open.`);
  console.log('   Press Ctrl+C to end early.\n');

  // 5. Hard TTL.
  if (TTL_SEC > 0) {
    setTimeout(() => {
      console.error(`[cred-req] TTL expired — tearing down`);
      cleanup(0);
    }, TTL_SEC * 1000);
  }
})().catch((e) => fail(e.message));
