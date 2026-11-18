---
name: acp-connector
version: "1.1.0"
description: Self-reminders and agent-managed scheduled jobs via the acp-connector bridge MCP tools. Use when running behind acp-connector (Telegram/Discord bridge) and needing to schedule follow-ups, snooze checks, or create recurring jobs.
metadata:
  author: galiprandi
  tags: [acp-connector, reminders, cron, jobs, scheduling, mcp]
---

# ACP Connector

`acp-connector` is the thin bridge that connects you (an ACP agent) to the operator's messaging platforms (Telegram, Discord, HTTP, A2A peers). Every inbound message — user chats, cron fires, reminders — lands in one serialized prompt queue and reaches you as a plain prompt.

When running behind it, an `acp-tools` MCP server is injected into your session with `send_file`, `list_aliases` and the unified `jobs` tool. If those tools aren't visible, the bridge or the agent harness doesn't support MCP servers — scheduling isn't available; tell the user.

## jobs tool — all scheduled work

One tool covers one-shot reminders, recurring schedules and manual jobs:

| Action | Purpose |
|---|---|
| `jobs({action:"create", in? \| at? \| every? \| expr? \| manual, name?, prompt})` | Create a job. `in`: `"20m"`, `"2 hours"`; `at`: absolute ("tomorrow 10am", ISO); `every`: `"1h"`, `"1d"`; `expr`: 5-field cron; `manual:true` requires `name` |
| `jobs({action:"list"})` | All jobs — yours are `managed:"agent"`, operator's are read-only. Includes `firesAtLocal` and `now` in the configured timezone |
| `jobs({action:"update", id, ...})` | Change schedule/prompt/name/enabled — agent jobs only |
| `jobs({action:"delete", id})` | Delete — agent jobs only |
| `jobs({action:"run", id \| name})` | Deliver the prompt now, schedule untouched |
| `jobs({action:"toggle", id})` | Pause/resume — agent jobs only |

- On fire, the prompt lands in your queue as a new message — **write `prompt` fully self-contained**: who, what to check, what to do next. You won't see this conversation then.
- `at` needs an explicit offset or the bridge's configured `timezone`; naive datetimes without either are rejected.
- Changes apply **immediately** — timers re-arm in-process. Never restart the bridge to apply job changes.
- Once jobs are deleted on delivery; undeliverable ones are retried on reconnect. Max 50 agent jobs.
- You cannot modify operator jobs (`managed:"operator"`). If one needs changing, tell the user — never work around it by creating a duplicate.

### Follow-up loop pattern (WhatsApp / email / any outreach)

The canonical use: after sending a message that needs a reply, schedule a check — never fire-and-forget.

1. Send the message (e.g. WhatsApp to a contact).
2. `jobs({action:"create", prompt:"Check WhatsApp chat with <name>: did they reply to <topic>? If yes, <next step>. If not, resched with backoff.", in:"15m"})`.
3. When the job fires: check for a reply.
   - Replied → handle it, done. No new job.
   - No reply → create again with growing delay (15m → 30m → 1h → 3h). Include elapsed time in the prompt.
4. After ~24h of silence: stop rescheduling and notify the user through the normal channel instead of looping forever.

## Operator config (acp-connector.jsonc)

Single JSONC file next to where the bridge runs. Keys an agent may need to touch **with the user's permission**:

```jsonc
{
  "agentCmd": "devin acp",
  "timezone": "America/Argentina/Buenos_Aires",
  "platforms": { "telegram": { "token": "...", "allowedChatIds": [123] } },
  "echoInjectedPrompts": true,
  "logLevel": "info"
}
```

- Runtime state (jobs, session id, aliases) lives in `.acp-connector/state.json` — **never edit it by hand**: the running bridge rewrites it atomically and your edits are lost. Jobs always go through the `jobs` tool.
- Config edits to `acp-connector.jsonc` only apply on boot.

## Restart policy — recommend, never execute

**NEVER run `pm2 restart`, `pm2 stop`, `npm run daemon:stop`, `kill`, or anything that restarts the bridge yourself.** You run *inside* it: restarting kills your own session mid-prompt, the inbound message is never acknowledged, Telegram/Discord redelivers it, and the bridge enters a restart loop.

The only case a restart is genuinely needed: **manual edits to `acp-connector.jsonc`** (agentCmd, tokens, timezone, platform settings) — those load at boot and don't apply live. In that case:

1. Tell the user the config changed and **explain why a restart matters**: the bridge reads config only at startup, so without a restart the new values never take effect.
2. **Recommend** the restart and let the user do it (`pm2 restart donna-bridge` / `npm run daemon` restart) or explicitly authorize it.
3. Only run it yourself with the user's **explicit consent in the same conversation** — and warn them first that the reply may arrive after the bridge comes back.

Everything else — jobs, aliases, sessions — is live. No restart needed, ever.
