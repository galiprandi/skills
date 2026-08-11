---
name: browser-core
description: Control a dedicated browser via playwright-cli for web automation. Use when automating web apps, filling forms, scraping data, testing flows, or managing sessions across multiple sites. Covers the safe wrapper, golden rules for reliability, tab parallelization, snapshots, eval, and all core commands. Site-specific tips live in separate skills (linkedin, gmail, etc.).
allowed-tools: Bash(playwright-cli:*) Bash(npx:*) Bash(npm:*) Bash(node:*)
---

# Browser Core

Control a dedicated Chromium browser via `playwright-cli` from the terminal. Token-efficient: commands return concise output, not verbose accessibility trees.

## Setup

### Install

```bash
npm install -g @playwright/cli@latest
playwright-cli install-browser        # downloads chromium
```

### Profile directory (NEVER commit)

Use a persistent profile to preserve cookies/logins across sessions. Always gitignore it.

```bash
# Create a profile dir at repo root (or anywhere outside git tracking)
mkdir -p .browser-profile

# Add to .gitignore IMMEDIATELY
echo ".browser-profile/" >> .gitignore
echo ".playwright-cli/" >> .gitignore
echo "*.session-state.json" >> .gitignore
echo ".browser-config.json" >> .gitignore

# Open with persistent profile
playwright-cli open "https://example.com" --persistent --profile ./.browser-profile
```

**Rules:**
- Profile dir contains cookies, localStorage, session data. NEVER commit it.
- If you clone a repo, create the profile dir fresh. Never share profiles.
- Use `--headed` for manual login (captchas, 2FA). Default is headless.

### The safe wrapper (recommended)

The wrapper script (`scripts/browser.js` in this skill) guarantees the profile is always used, prevents race conditions, manages parallel sessions, and reads browser mode from config. **Always use the wrapper for open/goto/close.** Never call `playwright-cli open` directly.

Copy the wrapper to your repo:

```bash
# From the skills repo, copy to your project
cp browser-core/scripts/browser.js /path/to/your-repo/scripts/browser.js
```

Create a config file (optional, defaults to headless):

```bash
# .browser-config.json in your repo root
echo '{"browser_mode": "headed_logins_only"}' > .browser-config.json
```

Config resolution for `browser_mode` (headed vs headless):
1. `--headed` / `--headless` flag passed to `open`
2. `.browser-config.json`: `{ "browser_mode": "headed" }`
3. `BROWSER_MODE` environment variable
4. Default: `headless`

Mode values:
- `headless` — always headless
- `headed` — always headed (visible browser)
- `headed_logins_only` — headless by default, caller passes `--headed` for manual logins

```bash
# Core commands (always use the wrapper for these)
node scripts/browser.js open <url> [--headed|--headless] [--session <name>]
node scripts/browser.js goto <url> [--tab <name>] [--session <name>]
node scripts/browser.js close [--session <name>] [--force]
node scripts/browser.js close-all [--force]
node scripts/browser.js ensure [--session <name>]

# Passthrough to playwright-cli (for click, fill, snapshot, eval, etc.)
node scripts/browser.js exec <cmd> [args...] [--tab <name>] [--session <name>]

# Sessions for parallel subagents
node scripts/browser.js attach --session <name>
node scripts/browser.js detach --session <name>
node scripts/browser.js who                         # list active attached agents

# Tab management
node scripts/browser.js tab-new <url> --name <name> [--session <name>]
node scripts/browser.js tab-select <name> [--session <name>]
node scripts/browser.js tab-close <name> [--session <name>]
node scripts/browser.js tab-close-all [--session <name>]
node scripts/browser.js tab-list [--session <name>] [--json]

# Auth state persistence
node scripts/browser.js save-state [--filename <path>] [--session <name>]
node scripts/browser.js load-state [--filename <path>] [--session <name>]

# Debugging
node scripts/browser.js dashboard
node scripts/browser.js trace-start [--session <name>]
node scripts/browser.js trace-stop [--session <name>]
node scripts/browser.js video-start [--filename <path>] [--session <name>]
node scripts/browser.js video-stop [--session <name>]
node scripts/browser.js console [level] [--session <name>]
node scripts/browser.js requests [--session <name>]
node scripts/browser.js request <index> [--session <name>]

# Info
node scripts/browser.js list
node scripts/browser.js status
```

**Key wrapper behaviors:**
- `--profile=.browser-profile` is hardcoded. Cannot be omitted.
- If a session is already running, `open` auto-navigates instead of failing.
- Lockfile prevents race conditions when multiple processes open the browser.
- Health check detects zombie sessions before reuse.
- Ref-count prevents one agent from killing the browser while others work.
- For all playwright-cli commands (click, fill, snapshot, eval) use `exec` or call `playwright-cli` directly AFTER opening via the wrapper.

### Headed vs headless

```bash
# Headless (default) — for automation
node scripts/browser.js open "https://example.com"

# Headed — for manual login, captcha solving, visual debugging
node scripts/browser.js open "https://example.com" --headed
```

When a session expires or a captcha appears: open headed, let the user log in manually, save state, then continue headless. See [references/profile-management.md](references/profile-management.md).

## Golden rules (validated empirically)

These rules were validated through extensive testing. Breaking them causes failure.

### Rule 1: eval > ref-based clicks

Refs (`[ref=e123]`) are per-snapshot and **do not persist** between separate `playwright-cli` CLI calls. A ref from one `snapshot` call is invalid by the next `click` call.

**Wrong:**
```
snap = snapshot()
ref = findRef(snap, "Message")
clickRef(ref)  # may fail, ref may be stale
```

**Right:**
```bash
# Use eval to find and click by text in one atomic call
playwright-cli eval "(function(){
  const els = document.querySelectorAll('a, button, [role=\"link\"]');
  for (const el of els) {
    if (el.textContent.includes('Message')) { el.click(); return 'clicked'; }
  }
  return 'not_found';
})()"
```

### Rule 2: In-page polling > shell sleep

Shell `sleep` between browser commands kills the playwright-cli daemon session. The session dies within 5-10 seconds of inactivity.

**Wrong:**
```bash
playwright-cli goto "https://example.com"
sleep 4                        # session may die here
playwright-cli snapshot        # fails: "No active session"
```

**Right:**
```bash
# Use eval with in-page polling (keeps connection alive)
playwright-cli goto "https://example.com"
playwright-cli eval "(async function(){
  for (let i = 0; i < 50; i++) {
    if (document.querySelector('div.target-element')) return 'ready';
    await new Promise(r => setTimeout(r, 200));
  }
  return 'timeout';
})()"
```

**Exception:** Very short sleeps (1-2s) within a single shell command using `&&` chaining are safe. The session stays alive as long as the shell process is running.

### Rule 3: Read snapshot file as fallback

When `exec snapshot` fails (session briefly busy), the `open`/`goto` commands auto-generate a snapshot YAML file in `.playwright-cli/`. Read it directly.

```bash
# Try exec snapshot first
node scripts/browser.js exec snapshot
# If it fails, read the latest snapshot file
ls -t .playwright-cli/page-*.yml | head -1 | xargs cat
```

### Rule 4: Use URLs directly, not clicks for navigation

Navigating to a specific URL is more reliable than clicking navigation links.

**Wrong:** Click "Messaging" icon in header
**Right:** `node scripts/browser.js goto "https://www.linkedin.com/messaging/"`

**Wrong:** Click "Saved Jobs" menu item
**Right:** `node scripts/browser.js goto "https://www.linkedin.com/jobs-tracker/?stage=saved"`

### Rule 5: Verify with DOM content, not URL

SPAs (LinkedIn, Gmail, React apps) update the right panel without changing the URL.

**Wrong:** Check if URL changed after clicking a conversation
**Right:** Check if the target container exists and matches expected content

```bash
playwright-cli eval "(function(){
  const panel = document.querySelector('.msg-s-message-list-container');
  const header = document.querySelector('h2');
  if (panel && header && header.textContent.includes('Person Name')) return 'ok';
  return 'not_loaded';
})()"
```

### Rule 6: Batch operations into a single eval call

Doing wait + click + verify in one `eval` call is more robust than multiple separate CLI calls. Each separate call risks session death between steps and adds latency.

**Wrong:**
```bash
playwright-cli eval "document.querySelector('#btn')"
playwright-cli eval "document.querySelector('#btn').click()"
playwright-cli eval "document.querySelector('#result')"
```

**Right:**
```bash
playwright-cli eval "(function(){
  const btn = document.querySelector('#btn');
  if (!btn) return 'not_found';
  btn.click();
  const result = document.querySelector('#result');
  return result ? result.textContent : 'no_result';
})()"
```

### Chaining: open + eval in a single shell command

Chain `open && eval` in a single shell command to prevent session death between calls.

**Wrong:**
```bash
node scripts/browser.js open "https://mail.google.com"
# session may die here
node scripts/browser.js exec eval "document.title"
```

**Right:**
```bash
node scripts/browser.js open "https://mail.google.com" && \
  node scripts/browser.js exec eval "document.title"
```

## Core commands

### Open / navigate / close

```bash
playwright-cli open [url]              # open browser (headless by default)
playwright-cli open [url] --headed     # open visible browser
playwright-cli goto <url>              # navigate current tab
playwright-cli go-back                 # browser back button
playwright-cli go-forward              # browser forward button
playwright-cli reload                  # reload page
playwright-cli close                   # close browser
```

### Snapshot (the most important command)

```bash
playwright-cli snapshot                # capture page structure with element refs
playwright-cli snapshot <ref>          # snapshot a specific element
playwright-cli snapshot "#main"        # snapshot a CSS selector
```

Returns a tree of the page with `[ref=eXXX]` identifiers. Use these refs for click/fill/select. **Always take a fresh snapshot before interacting** — refs change after any page mutation.

### Find (search within snapshot)

```bash
playwright-cli find "text"             # search current snapshot for text
playwright-cli find "regex"            # search with regex
playwright-cli find --regex "/sign (in|up)/i"  # with flags
```

Returns matching nodes with context. Useful for locating elements without a full snapshot.

### Interact

```bash
playwright-cli click <ref>             # click an element
playwright-cli click <ref> right       # right-click
playwright-cli dblclick <ref>          # double-click
playwright-cli fill <ref> "text"       # fill input/textarea (replaces content)
playwright-cli fill <ref> "text" --submit  # fill + press Enter
playwright-cli type "text"             # type into focused element (appends)
playwright-cli select <ref> "value"    # select dropdown option
playwright-cli check <ref>             # check checkbox/radio
playwright-cli uncheck <ref>           # uncheck checkbox
playwright-cli hover <ref>             # hover over element
playwright-cli press Enter             # press keyboard key
playwright-cli upload <file>           # upload file to file chooser
playwright-cli drag <startRef> <endRef>  # drag and drop
```

### Eval (run JavaScript in page context)

```bash
# Simple expression
playwright-cli eval "() => document.title"

# Access DOM
playwright-cli eval "() => document.querySelector('h1')?.textContent"

# Run inline IIFE for complex logic
playwright-cli eval "(function(){ return JSON.stringify({url: location.href, title: document.title}) })()"

# Eval on a specific element (ref becomes 'element' inside)
playwright-cli eval "() => element.textContent" <ref>

# Async eval (fetch with cookies)
playwright-cli eval "(async () => { const r = await fetch('/api/data'); return JSON.stringify(await r.json()) })()"
```

Eval runs in the page context with all cookies. Use it for:
- Extracting data not visible in snapshots
- Calling site APIs (fetch with cookies)
- Checking page state (URL, title, DOM)
- Clicking by text (more reliable than ref-based clicks, see Rule 1)
- Waiting for elements (in-page polling, see Rule 2)

### Screenshot / PDF

```bash
playwright-cli screenshot              # full page screenshot
playwright-cli screenshot <ref>        # screenshot specific element
playwright-cli screenshot --filename=page.png
playwright-cli pdf --filename=page.pdf # save page as PDF
```

## Tab management (parallelization)

Tabs let you work on multiple sites simultaneously in one browser instance.

```bash
playwright-cli tab-new [url]           # create new tab
playwright-cli tab-list                # list all tabs with indices
playwright-cli tab-select <index>      # switch to tab by index
playwright-cli tab-close [index]       # close tab (current if no index)
```

**Parallelization pattern:** open one tab per site, switch between them with `tab-select`.

```bash
playwright-cli open "https://gmail.com"
playwright-cli tab-new "https://linkedin.com"
playwright-cli tab-new "https://discord.com"

# Work on Gmail (tab 0)
playwright-cli tab-select 0
playwright-cli snapshot

# Switch to LinkedIn (tab 1)
playwright-cli tab-select 1
playwright-cli snapshot

# Close when done
playwright-cli tab-close 1
```

**Tab tips:**
- Tab 0 is the main tab. Don't close it while other tabs are open.
- `tab-list` shows `(current)` next to the active tab.
- Tabs share the same browser profile (cookies, localStorage).
- Close duplicate tabs when finished to save resources.

For the wrapper's named tab management (more reliable for parallel work), see [references/parallel-agents.md](references/parallel-agents.md).

## Session management (parallel subagents)

`playwright-cli attach <name>` creates a separate session attached to the same browser, enabling true parallel work (e.g. subagents each with their own active tab).

```bash
# Primary session
node scripts/browser.js open "https://example.com"

# Attach a new session (each gets independent active tab)
node scripts/browser.js attach --session worker-1

# Run commands in the worker session
node scripts/browser.js exec snapshot --session worker-1
node scripts/browser.js exec goto "https://other.com" --session worker-1

# Detach when done
node scripts/browser.js detach --session worker-1
```

**When to use sessions vs tabs:**
- Tabs: sequential work on multiple sites (one agent switching between them) — reliable
- Sessions: parallel work (multiple subagents, each with its own active tab) — enables true parallelism

See [references/parallel-agents.md](references/parallel-agents.md) for the full parallel subagent pattern.

## State persistence

### Save/load auth state

```bash
# Save cookies + localStorage after manual login
node scripts/browser.js save-state

# Load saved state in a new session
node scripts/browser.js open "https://example.com"
node scripts/browser.js load-state
```

**Workflow for sites requiring login:**
1. `node scripts/browser.js open "https://site.com" --headed`
2. User logs in manually (handles captcha, 2FA)
3. `node scripts/browser.js save-state`
4. `node scripts/browser.js close`
5. Next session: `open` then `load-state`

See [references/profile-management.md](references/profile-management.md) for full details.

### Cookies

```bash
playwright-cli cookie-list             # list all cookies
playwright-cli cookie-get <name>       # get specific cookie
playwright-cli cookie-set <name> <val> # set cookie
playwright-cli cookie-delete <name>    # delete cookie
```

## Network inspection

```bash
playwright-cli requests                 # list all network requests
playwright-cli request <index>          # full details of request N
playwright-cli request-headers <index>  # request headers only
playwright-cli request-body <index>     # request body only
playwright-cli response-headers <index> # response headers only
playwright-cli response-body <index>    # response body
```

Useful for:
- Capturing API calls sites make internally
- Extracting CSRF tokens from request headers
- Debugging failed requests

## Console

```bash
playwright-cli console                  # all console messages
playwright-cli console error            # only errors
playwright-cli console warning          # only warnings
```

## Efficiency patterns (save tokens)

**Shallow snapshot first (depth-limited):**
```bash
playwright-cli snapshot --depth=4       # less tokens than full snapshot
playwright-cli snapshot e34             # snapshot a specific element from shallow
```

**Search for specific text instead of full snapshot:**
```bash
playwright-cli find "Apply"
playwright-cli find --regex "/sign (in|up)/i"
playwright-cli find "Easy Apply"
```

**Fill + submit in one command:**
```bash
playwright-cli fill e15 "search term" --submit   # fill + press Enter atomically
```

**Detect errors without snapshots:**
```bash
node scripts/browser.js console error    # check for JS errors
node scripts/browser.js requests         # check for failed network requests
```

**Extract data with eval + fetch (avoid UI navigation):**
```bash
playwright-cli eval "(async () => { const r = await fetch('/api/data'); return JSON.stringify(await r.json()) })()"
```

## Key patterns

### Always snapshot before interacting

Refs (`[ref=eXXX]`) change after every action (click, fill, navigate, even async updates). Never reuse a ref from a previous snapshot.

```bash
playwright-cli snapshot           # get fresh refs
playwright-cli click e42          # use ref from THIS snapshot
playwright-cli snapshot           # get fresh refs again
playwright-cli fill e55 "text"    # use new ref
```

### Wait for page load

After `goto` or `click` that triggers navigation, use in-page polling (Rule 2):

```bash
playwright-cli goto "https://example.com"
playwright-cli eval "(async function(){
  for (let i = 0; i < 50; i++) {
    if (document.querySelector('[data-loaded]')) return 'ready';
    await new Promise(r => setTimeout(r, 200));
  }
  return 'timeout';
})()"
```

For SPA navigation (URL doesn't change but content updates), use `eval` to check:

```bash
playwright-cli eval "() => document.querySelector('[data-loaded]') ? 'ready' : 'loading'"
```

### Custom components need eval

Some sites use custom web components (Google Search, LinkedIn tiptap editor, React widgets). `fill` and `type` may not work on them. Use `eval` as fallback:

```bash
# If fill doesn't work on a custom input
playwright-cli eval "(function() {
  const el = document.querySelector('[role=textbox]');
  el.innerHTML = 'text';
  el.dispatchEvent(new Event('input', {bubbles: true}));
})()"
```

**React-controlled inputs need native value setter:**
```bash
playwright-cli eval "(function() {
  const el = document.querySelector('input');
  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  nativeSetter.call(el, 'your value');
  el.dispatchEvent(new Event('input', { bubbles: true }));
})()"
```

### Buttons that ignore plain .click()

Some buttons (Gmail send, custom UI) require a mousedown -> click -> mouseup sequence:

```bash
playwright-cli eval "(function() {
  const btn = document.querySelector('div[role=button]');
  btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
})()"
```

## Anti-patterns

- **Don't** reuse refs across snapshots
- **Don't** use `type` without a ref for multiline text (CLI parses newlines as args)
- **Don't** commit `.browser-profile/` or any auth state file
- **Don't** open a second browser instance if one is already running (use tabs or sessions)
- **Don't** use `--headless` flag (it's the default; use `--headed` when you need visible)
- **Don't** try to solve captchas programmatically (open headed and ask the user)
- **Don't** use shell `sleep` between separate CLI calls (kills the session, see Rule 2)
- **Don't** split wait + click + verify into separate CLI calls (batch into one eval, see Rule 6)
- **Don't** call `playwright-cli open` directly when using the wrapper (use `node scripts/browser.js open`)
- **Don't** verify SPA navigation by URL change (check DOM content, see Rule 5)

## Full command reference

See [references/playwright-cli.md](references/playwright-cli.md) for the complete command list with all options.

## Parallel subagent pattern

See [references/parallel-agents.md](references/parallel-agents.md) for the full pattern of running multiple subagents with independent tab contexts.

## Profile management

See [references/profile-management.md](references/profile-management.md) for profile dir setup, auth state persistence, and headed/headless workflow.
