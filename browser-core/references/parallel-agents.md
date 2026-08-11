# Parallel Subagent Browser Pattern

How to run multiple subagents that need browser access simultaneously, each with its own independent active tab.

## Architecture

```
Coordinator
├── open browser (primary session "default")
├── tab-new "https://gmail.com" --name gmail
├── tab-new "https://linkedin.com" --name linkedin
├── attach --session gmail-worker
├── attach --session linkedin-worker
│
├── Subagent A (gmail-worker)
│   └── exec snapshot --tab gmail --session gmail-worker
│
├── Subagent B (linkedin-worker)
│   └── exec snapshot --tab linkedin --session linkedin-worker
│
└── Cleanup
    ├── detach --session gmail-worker
    ├── detach --session linkedin-worker
    └── close-all
```

## Why attached sessions work

`playwright-cli attach` creates a new session connected to the same browser, but with its own active tab context. Two sessions can have different active tabs simultaneously without interference. No locks needed between attached sessions.

The primary session ("default") shares tab context with the browser. Attached sessions get their own tab context. This means:
- Attached session A can be on tab 0 while attached session B is on tab 1
- No tab-select conflicts between attached sessions
- The primary session still needs locks for tab operations (it shares with the browser)

## Full pattern

```bash
# 1. Coordinator opens browser and creates named tabs
node scripts/browser.js open "https://gmail.com" --headless
node scripts/browser.js tab-new "https://linkedin.com" --name linkedin
node scripts/browser.js tab-new "https://example.com" --name db

# 2. Attach a session per subagent (each gets independent active tab)
node scripts/browser.js attach --session gmail-worker
node scripts/browser.js attach --session linkedin-worker

# 3. Subagents work in parallel without locks
# Subagent A:
node scripts/browser.js exec snapshot --tab gmail --session gmail-worker
# Subagent B:
node scripts/browser.js exec snapshot --tab linkedin --session linkedin-worker

# 4. Cleanup
node scripts/browser.js detach --session gmail-worker
node scripts/browser.js detach --session linkedin-worker
node scripts/browser.js close-all
```

## Safe close (ref-count)

`close` and `close-all` check for live attached sessions before killing the browser. If other agents are active:
- `close` refuses (use `--force` to override)
- `close-all` refuses (use `--force` to override)

```bash
# Check who is active
node scripts/browser.js who

# Safe close (refuses if agents active)
node scripts/browser.js close

# Force close (kills browser even if agents active)
node scripts/browser.js close --force
node scripts/browser.js close-all --force
```

## Auto-attach on `open --session`

If a browser is already running and you call `open` with a different `--session` name, the wrapper automatically attaches a new session to the existing browser (instead of killing it by opening a second instance with the same profile). The attached session gets its own tab so it doesn't clobber the primary session's active tab.

```bash
# Primary session already running
node scripts/browser.js open "https://gmail.com"

# This attaches instead of killing the existing browser
node scripts/browser.js open "https://linkedin.com" --session worker-1
```

## Alternative: PLAYWRIGHT_CLI_SESSION env var

Subagents can set `PLAYWRIGHT_CLI_SESSION` once and then call `playwright-cli` directly without `-s=` on every command:

```bash
PLAYWRIGHT_CLI_SESSION=gmail-worker playwright-cli snapshot
PLAYWRIGHT_CLI_SESSION=gmail-worker playwright-cli eval "document.title"
```

## When to use what

| Pattern | Use case | Parallelism |
|---|---|---|
| Tabs only | One agent switching between sites | Sequential |
| Sessions (attach) | Multiple subagents, each with own tab | True parallel |
| Env var + direct calls | Subagents that call playwright-cli directly | True parallel |

## Pitfalls

- **Don't** close the primary session while attached sessions are active (use `who` to check)
- **Don't** open a second browser with `playwright-cli open` directly (use `attach` or the wrapper's auto-attach)
- **Don't** forget to `detach` when a subagent finishes (leaves stale sessions)
- **Don't** use `kill-all` when one session is zombie (use targeted `close --session <name>`)
