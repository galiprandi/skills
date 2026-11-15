---
name: remote-desktop
version: "1.0.0"
description: Give the user live view+control of this machine's desktop through an ephemeral Cloudflare tunnel (KasmVNC). Use when the user needs to interact with the screen themselves — entering credentials, 2FA, visual verification — and cannot do it through the browser alone.
allowed-tools: Bash(*)
metadata:
  author: galiprandi
  tags: [remote-desktop, vnc, kasmvnc, cloudflare, tunnel, take-control]
---

# Remote Desktop — user takes control of the screen

## Purpose

Expose the pod's KasmVNC desktop (`https://127.0.0.1:6901`, sslOnly) through
an ephemeral Cloudflare quick tunnel so the user can see and control the
machine from their phone.

**Use when:** the user must type credentials/2FA/captcha on a screen, verify
something visually, or take over an interactive flow the browser skill can't
complete remotely.

**Do NOT use for:** routine automation (use browser-automation), or as a
permanent access channel — tunnels are ephemeral by design.

## How it works

`scripts/pod-vnc` manages two processes:

1. `vnc-proxy.py` — HTTP/WebSocket proxy on `127.0.0.1:6099` that terminates
   plain HTTP, injects KasmVNC's Basic auth (`kasm_user:$VNC_PW`) and the
   `Sec-WebSocket-Origin` header KasmVNC requires, and serves the native
   KasmVNC web UI.
2. `cloudflared tunnel --url http://127.0.0.1:6099` — quick tunnel with a
   random `*.trycloudflare.com` URL.

**The URL is the credential.** Whoever opens it gets full desktop control —
the proxy injects auth, so no password is asked. Treat it like a secret:
send it only to the user, and run `pod-vnc stop` when the session ends.

## Usage

```bash
bash .agents/skills/remote-desktop/scripts/pod-vnc start   # prints the URL
bash .agents/skills/remote-desktop/scripts/pod-vnc status
bash .agents/skills/remote-desktop/scripts/pod-vnc stop
```

- `start` prints the public URL — send it to the user verbatim.
- The URL changes every time the tunnel restarts; always re-run `status`
  or `start` to get the current one.
- KasmVNC must be running (it is, in pod deployments). If `start` fails,
  check `~/.local/state/pod-vnc/proxy.log` and `cf.log`.

## Rules

- Always tell the user what the link does BEFORE they open it, and remind
  them it grants full control of this machine's desktop.
- `pod-vnc stop` as soon as the user finishes — do not leave tunnels
  running unattended.
- Never share the URL in group chats or forward it.
- If the user asks for persistent remote access, say this is ephemeral-only
  and escalate — do not improvise named tunnels or open ports.
