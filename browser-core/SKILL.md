---
name: browser-core
description: Control a dedicated browser via playwright-cli for web automation. Use when automating web apps, filling forms, scraping data, testing flows, or managing sessions across multiple sites. Covers profile-dir setup, tab parallelization, snapshots, eval, and all core commands. Site-specific tips live in separate skills (linkedin, gmail, etc.).
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

# Open with persistent profile
playwright-cli open "https://example.com" --persistent --profile ./.browser-profile
```

**Rules:**
- Profile dir contains cookies, localStorage, session data. NEVER commit it.
- If you clone a repo, create the profile dir fresh. Never share profiles.
- Use `--headed` for manual login (captchas, 2FA). Default is headless.

### Headed vs headless

```bash
# Headless (default) — for automation
playwright-cli open "https://example.com"

# Headed — for manual login, captcha solving, visual debugging
playwright-cli open "https://example.com" --headed
```

When a session expires or a captcha appears: open headed, let the user log in manually, then continue headless.

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
```

Returns a tree of the page with `[ref=eXXX]` identifiers. Use these refs for click/fill/select. **Always take a fresh snapshot before interacting** — refs change after any page mutation.

### Find (search within snapshot)

```bash
playwright-cli find "text"             # search current snapshot for text
playwright-cli find "regex"            # search with regex
```

Returns matching nodes with context. Useful for locating elements without a full snapshot.

### Interact

```bash
playwright-cli click <ref>             # click an element
playwright-cli click <ref> right       # right-click
playwright-cli dblclick <ref>          # double-click
playwright-cli fill <ref> "text"       # fill input/textarea (replaces content)
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
```

Eval runs in the page context with all cookies. Use it for:
- Extracting data not visible in snapshots
- Calling site APIs (fetch with cookies)
- Checking page state (URL, title, DOM)

### Screenshot / PDF

```bash
playwright-cli screenshot              # full page screenshot
playwright-cli screenshot <ref>        # screenshot specific element
playwright-cli pdf                     # save page as PDF
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

## Session management (experimental)

`playwright-cli attach <name>` creates a separate session attached to the same browser, enabling true parallel work (e.g. subagents each with their own active tab).

**Status:** Experimental in playwright-cli 0.1.17. The `attach` command may crash or fail to register. If you need parallelism, use tabs (reliable) instead.

```bash
# Primary session
playwright-cli open "https://example.com"

# Attach a new session (if supported by your version)
playwright-cli attach worker-1

# Run commands in the worker session
playwright-cli -s=worker-1 goto "https://other.com"
playwright-cli -s=worker-1 snapshot

# Detach when done
playwright-cli -s=worker-1 detach
```

**When to use sessions vs tabs:**
- Tabs: sequential work on multiple sites (one agent switching between them) — **reliable**
- Sessions: parallel work (multiple subagents, each with its own active tab) — **experimental**

## State persistence

### Save/load auth state

```bash
# Save cookies + localStorage after manual login
playwright-cli state-save ./.browser-profile/auth-state.json

# Load saved state in a new session
playwright-cli open "https://example.com"
playwright-cli state-load ./.browser-profile/auth-state.json
```

**Workflow for sites requiring login:**
1. `playwright-cli open "https://site.com" --headed`
2. User logs in manually (handles captcha, 2FA)
3. `playwright-cli state-save ./.browser-profile/auth-state.json`
4. `playwright-cli close`
5. Next session: `playwright-cli open "https://site.com"` then `playwright-cli state-load ./.browser-profile/auth-state.json`

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
playwright-cli response-body <index>    # response body (text inlined, binary to file)
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

## Debugging

```bash
playwright-cli tracing-start            # start trace recording
playwright-cli tracing-stop             # stop recording (view with playwright show-trace)
playwright-cli video-start [filename]   # start video recording
playwright-cli video-stop               # stop video
playwright-cli show                      # open playwright dashboard
playwright-cli highlight <ref>          # highlight an element visually
playwright-cli generate-locator <ref>   # generate playwright locator for element
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

After `goto` or `click` that triggers navigation, wait before snapshotting:

```bash
playwright-cli goto "https://example.com"
sleep 3                           # wait for JS to render
playwright-cli snapshot
```

For SPA navigation (URL doesn't change but content updates), use `eval` to check:

```bash
playwright-cli eval "() => document.querySelector('[data-loaded]') ? 'ready' : 'loading'"
```

### Custom components need eval

Some sites use custom web components (Google Search, LinkedIn tiptap editor, React widgets). `fill` and `type` may not work on them. Use `eval` as fallback:

```bash
# If fill doesn't work on a custom input
playwright-cli eval "() => { const el = document.querySelector('[role=textbox]'); el.innerHTML = 'text'; el.dispatchEvent(new Event('input', {bubbles: true})) }"
```

### Extract data with eval + fetch

Run API calls inside the page context to get cookies automatically:

```bash
playwright-cli eval "(async () => { const r = await fetch('/api/data'); return JSON.stringify(await r.json()) })()"
```

## Anti-patterns

- **Don't** reuse refs across snapshots
- **Don't** use `type` without a ref for multiline text (CLI parses newlines as args)
- **Don't** commit `.browser-profile/` or any auth state file
- **Don't** open a second browser instance if one is already running (use tabs or sessions)
- **Don't** use `--headless` flag (it's the default; use `--headed` when you need visible)
- **Don't** try to solve captchas programmatically (open headed and ask the user)

## Full command reference

See [references/playwright-cli.md](references/playwright-cli.md) for the complete command list with all options.
