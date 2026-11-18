---
name: remote-desktop
version: "1.1.1"
description: Give the user temporary control of this machine's desktop when they must do something only a human can do on screen — sign in (username, password, 2FA), solve a captcha or anti-bot challenge, or simply look at the desktop. Reach for it as soon as the user says they need to log in, enter a password, complete a verification, or see the screen — do not wait to be asked for a tunnel. Ephemeral by design, never a routine automation tool or a permanent access channel.
allowed-tools: Bash(*)
metadata:
  author: galiprandi
  tags: [remote-desktop, vnc, kasmvnc, cloudflare, tunnel, take-control, login, captcha, 2fa]
---

# Remote Desktop — hand the screen to the user

## Purpose

Expose this machine's KasmVNC desktop (`https://127.0.0.1:6901`, sslOnly)
through an ephemeral Cloudflare tunnel so the user can **see and control the
screen from their phone**.

## When to use — read this first

Offer the tunnel **proactively** whenever the user has to do something on
screen that the agent must not do for them. You do not need permission to
suggest it; you do need to say what the link does before they open it.

| Situation | Use it? |
|---|---|
| User must sign in — username, password, 2FA/passcode | **Yes** |
| Captcha, "verify you are human", anti-bot block | **Yes** |
| User asks to see the screen / take over / "dejame entrar yo" | **Yes** |
| First-run setup where credentials are entered | **Yes** |
| Visual check the browser skill cannot perform | **Yes** |
| Routine browsing, scraping, form filling the agent can do | **No** — use `browser-automation` |
| Permanent or always-on remote access | **No** — ephemeral only |

If a site offers a **remote auth flow** (phone-number linking, push approval,
device code), prefer that — see "Credentials & login" in the consuming repo's
`AGENTS.md`. The tunnel is for flows that genuinely need a screen.

## How it works

`scripts/pod-vnc` manages two processes:

1. **`vnc-proxy.mjs`** (Node ≥ 20, zero dependencies) — HTTP/WebSocket proxy on
   `127.0.0.1:6099`. KasmVNC is `sslOnly` and needs Basic auth plus a
   `Sec-WebSocket-Origin` header; the proxy terminates plain HTTP, injects both,
   and serves the native KasmVNC web UI and websocket. `vnc-proxy.mjs` is the
   equivalent Python 3 fallback — `pod-vnc` picks Node first, then Python.
2. **`cloudflared tunnel --url http://127.0.0.1:6099`** — quick tunnel with a
   random `*.trycloudflare.com` URL.

### The URL is not the whole credential

Every `pod-vnc start` generates a **fresh 6-digit OTP** and prints it next to
the URL. Before serving anything, the proxy shows a code prompt; only after the
correct code does it set a session cookie and inject the KasmVNC credentials.

Hardening included:

- the WebSocket `upgrade` is gated too — no cookie, no tunnel (HTTP 403)
- `POST /otp` compares in constant time; 3 wrong attempts per IP → 429
- session cookie is `HttpOnly; Secure; SameSite=Lax`, 12 h default
- the KasmVNC password is **never** written into the HTML
- `/logout` drops the session
- `/healthz` answers without the gate (used by `pod-vnc start`)

## Usage

```bash
bash .agents/skills/remote-desktop/scripts/pod-vnc start   # prints URL + OTP
bash .agents/skills/remote-desktop/scripts/pod-vnc status  # URL, OTP, pids
bash .agents/skills/remote-desktop/scripts/pod-vnc stop    # tears down + wipes OTP
```

- Send the user the **URL and the code**, and say the link grants full control
  of this machine's desktop.
- The code expires after `POD_VNC_OTP_TTL` seconds (default 300). If it lapses,
  run `stop` then `start` for a fresh URL and code.
- The URL changes on every restart; always re-run `status` or `start`.
- KasmVNC must be running (it is, in pod deployments). If `start` fails, check
  `~/.local/state/pod-vnc/proxy.log` and `cf.log`.

### Tuning

| Env var | Default | Meaning |
|---|---|---|
| `POD_VNC_PORT` | 6099 | proxy listen port (keep unique per agent) |
| `POD_VNC_OTP` | random | fixed code instead of a random one |
| `POD_VNC_OTP_TTL` | 300 | code lifetime, seconds |
| `POD_VNC_OTP_TRIES` | 3 | wrong attempts per IP before lockout |
| `POD_VNC_SESSION_TTL` | 43200 | session cookie lifetime, seconds |

## Mobile notes (learned the hard way)

- **KasmVNC needs Chromium.** Safari is not supported (no Basic auth on
  websockets); Firefox is partial. Tell the user to open the link in
  Chrome/Edge/Brave on the phone.
- **The on-screen keyboard does not open by tapping a field.** The desktop is a
  canvas, not HTML inputs. KasmVNC shows a keyboard button only when its
  setting is on — the proxy already sets `virtual_keyboard_visible` and
  `enable_ime` for mobile user agents. If it still fails, the reliable path is
  **Clipboard**: paste the password into KasmVNC's clipboard panel and press
  Ctrl+V on the desktop.
- **Scaling**: the proxy forces a mobile viewport meta tag. Ask the user to
  pick *Local Scaling* in the client settings if the screen overflows.
- Never type or receive the user's password yourself. If they offer it, decline
  and point them to the tunnel.
- Never send a URL from memory, conversation history or logs — quick tunnels are
  ephemeral and a stale link silently goes nowhere. Always run `pod-vnc status`
  (or `start`) and send exactly what it prints, URL + OTP together.
- If the user reports the link does not load at all, check `status` first: the
  tunnel may be down, or their network may block `trycloudflare.com`.

## Rules

- Say what the link does BEFORE the user opens it, and remind them it grants
  full control of this machine's desktop.
- Send the URL **and the OTP** only to the user. Never in group chats, never
  forwarded, never in a public issue.
- `pod-vnc stop` as soon as the user finishes — do not leave tunnels running
  unattended. `stop` also wipes the OTP file.
- If the user asks for persistent remote access, say this is ephemeral-only and
  escalate — do not improvise named tunnels or open ports.
- Rotating `VNC_PW` per session is still pending upstream: until then the OTP
  is what protects a leaked URL.
