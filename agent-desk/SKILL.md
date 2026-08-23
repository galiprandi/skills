---
name: agent-desk
version: "1.0.0"
description: Manage tasks, events, sessions, and relationships via the agent-desk dashboard. Use when the agent needs to track work, manage a calendar, or maintain session continuity. Requires browser-automation skill for eval access.
allowed-tools: Bash(playwright-cli:*) Bash(npx:*) Bash(node:*)
metadata:
  author: galiprandi
  tags: [agent-desk, task-management, calendar, dashboard, agent-tools]
---

# Agent Desk

Manage tasks, events, sessions, links, and configuration through the agent-desk dashboard — a static SPA deployed on GitHub Pages that exposes a **synchronous** JavaScript API on `window.agentAPI`. The agent drives it via `eval` through playwright-cli.

## Purpose

Agent-desk is a dashboard/homepage for AI agents. It persists everything in IndexedDB (per-browser-profile storage) and exposes a sync API that the agent calls through browser `eval`. Use it as the agent's working memory: a task list, a calendar, a session log, and a relationship graph between them.

**Use for:**
- Tracking work items (tasks) with status, priority, due dates, and tags
- Managing a calendar of events (meetings, deadlines, reminders)
- Maintaining session continuity across runs (start/end sessions with summaries)
- Linking entities together (a task scheduled-for an event, a task blocked-by another task)
- Searching across all entities at once
- Customizing task states and other config for the current workflow

**Do NOT use for:**
- Multi-user collaboration or shared state (it's single-profile, local-only)
- Real-time sync across devices (data lives in one browser's IndexedDB)
- Heavy data storage (IndexedDB is fine for hundreds of records, not millions)
- Replacing a full database — it's a dashboard, not a backend
- Operations that don't fit the task/event/session model (use files or a real DB instead)

## Prerequisites

- The **browser-automation** skill installed and its wrapper (`scripts/browser.js`) copied into the consuming repo's `scripts/` dir. Agent-desk is driven entirely through `eval` — you need the browser open and the wrapper working first.
- The **agent-desk app deployed on GitHub Pages** at its public URL (e.g. `https://<owner>.github.io/<repo>/`). The app is a static SPA; no server is required.
- A **persistent browser profile** with the agent-desk URL set as the homepage, so every `open` lands on the dashboard. See browser-automation's profile-management reference for setup.
- Node.js 18+ and npm (for playwright-cli / the wrapper).

## Setup

### Point the browser at agent-desk

Open the app with the wrapper (reuse the persistent profile so data persists across runs):

```bash
node scripts/browser.js open "https://<owner>.github.io/<repo>/" --headed
```

If the profile already has agent-desk as its homepage, a bare `open` is enough:

```bash
node scripts/browser.js open --headed
```

### Verify the API is ready

The app exposes `window.agentAPI` once IndexedDB has initialized. **Always check `window.agentAPIReady` before calling any method** — calling the API before it's ready throws.

```bash
node scripts/browser.js exec eval "window.agentAPIReady"
# → true
```

If it returns `false` or `undefined`, the page is still loading. Poll in-page (never shell `sleep`):

```bash
node scripts/browser.js exec eval "(() => { const t0 = Date.now(); while (!window.agentAPIReady && Date.now() - t0 < 5000) {} return window.agentAPIReady })()"
```

### Confirm data persistence

Because data lives in IndexedDB on the persistent profile, records created in one run are available in the next. Verify by listing tasks after a fresh open:

```bash
node scripts/browser.js exec eval "JSON.stringify(agentAPI.tasks.list())"
```

## Golden rules

These rules prevent the most common failures. Breaking them causes errors or lost work.

1. **Always check `window.agentAPIReady` before calling any API method.** The API is not available until IndexedDB finishes initializing. Poll in-page if it isn't ready yet.
2. **All API methods are SYNC — they return values, not Promises. Never use `await`.** Call them directly: `agentAPI.tasks.create({...})` returns the record immediately. Wrapping in `await` or `.then()` is a bug.
3. **Call the API via `eval`, not by scraping the DOM.** The UI is a React SPA; the DOM is a presentation layer. The API is the source of truth and is far cheaper token-wise than parsing rendered HTML.
4. **Always start a session at the beginning and end it at the end.** `agentAPI.session.start({summary})` when you begin work, `agentAPI.session.end({summary})` when you're done. This gives continuity across runs — the next session can read the last one to resume.
5. **Use `data-testid` attributes only when you must touch the UI.** The API covers create/read/update/delete for all entities. Reach for UI interaction (clicks on `[data-testid="..."]`) only for things the API doesn't expose — e.g. opening a create dialog the user wants to see, or triggering a view change.
6. **Read `[data-testid="llm-instructions"]` for view-specific examples.** Each view hides a block of LLM-targeted guidance in the DOM. Read it when you land on a view to get validated snippets for that screen.
7. **Stringify return values when you need to read them.** `eval` returns a string to the CLI. Wrap list/get calls in `JSON.stringify(...)` so you can see the records: `JSON.stringify(agentAPI.tasks.list())`.

## API overview

Six namespaces on `window.agentAPI`. All methods are synchronous. See [references/api-reference.md](references/api-reference.md) for full signatures, schemas, and return types.

```bash
# tasks — create/read/update/delete work items
node scripts/browser.js exec eval "JSON.stringify(agentAPI.tasks.create({title: 'My task'}))"
# → {"id":"tsk_...","title":"My task","status":"todo","priority":"medium",...}

# events — calendar items with start/end times
node scripts/browser.js exec eval "JSON.stringify(agentAPI.events.create({title: 'Meeting', start: '2026-01-01T10:00:00Z'}))"
# → {"id":"evt_...","title":"Meeting","start":"2026-01-01T10:00:00Z",...}

# session — start/end work sessions for continuity
node scripts/browser.js exec eval "JSON.stringify(agentAPI.session.start({summary: 'Working on X'}))"
# → {"id":"ses_...","summary":"Working on X","startTime":...,"active":true}

# search — global search across tasks, events, and sessions
node scripts/browser.js exec eval "JSON.stringify(agentAPI.search('invoice'))"
# → {"tasks":[...],"events":[...],"sessions":[...]}

# links — relationships between any two entities (by id)
node scripts/browser.js exec eval "JSON.stringify(agentAPI.links.create({from: 'tsk_123', to: 'evt_456', type: 'scheduled-for'}))"
# → {"id":"lnk_...","from":"tsk_123","to":"evt_456","type":"scheduled-for"}

# config — get/set custom config (e.g. custom task states)
node scripts/browser.js exec eval "JSON.stringify(agentAPI.config.get('taskStates'))"
# → ["backlog","todo","in-progress","done"]
node scripts/browser.js exec eval "agentAPI.config.set('taskStates', ['backlog','todo','in-progress','review','done'])"
```

## Core patterns

### Starting a work session

Always begin by starting a session. Optionally read the previous session to resume context.

```bash
# Read the last session to see where we left off
node scripts/browser.js exec eval "JSON.stringify(agentAPI.session.get())"

# Start a new session
node scripts/browser.js exec eval "JSON.stringify(agentAPI.session.start({summary: 'Resuming invoice work'}))"
```

### Creating tasks with priorities and due dates

```bash
node scripts/browser.js exec eval "JSON.stringify(agentAPI.tasks.create({
  title: 'Send invoice to Acme',
  description: 'Q1 invoice for consulting work',
  status: 'todo',
  priority: 'high',
  dueDate: '2026-01-15T17:00:00Z',
  tags: ['billing', 'acme']
}))"
```

Priority is one of: `"low" | "medium" | "high" | "urgent"`. Status defaults to `"todo"`; the default state set is `["backlog", "todo", "in-progress", "done"]` (customize via `config.set`).

### Filtering tasks

`tasks.list` accepts optional filters. All filters are optional and combine with AND.

```bash
# By status
node scripts/browser.js exec eval "JSON.stringify(agentAPI.tasks.list({status: 'in-progress'}))"

# By priority
node scripts/browser.js exec eval "JSON.stringify(agentAPI.tasks.list({priority: 'urgent'}))"

# By tag
node scripts/browser.js exec eval "JSON.stringify(agentAPI.tasks.list({tag: 'billing'}))"

# By due-date range (ISO strings)
node scripts/browser.js exec eval "JSON.stringify(agentAPI.tasks.list({dueAfter: '2026-01-01T00:00:00Z', dueBefore: '2026-01-31T23:59:59Z'}))"
```

### Creating events and filtering by date range

Events require a `start` (ISO string). `end` is optional; `allDay` defaults to false.

```bash
node scripts/browser.js exec eval "JSON.stringify(agentAPI.events.create({
  title: 'Acme kickoff call',
  start: '2026-01-05T15:00:00Z',
  end: '2026-01-05T15:30:00Z',
  location: 'Zoom'
}))"

# Events in a date range (sorted by start)
node scripts/browser.js exec eval "JSON.stringify(agentAPI.events.list({from: '2026-01-01T00:00:00Z', to: '2026-01-31T23:59:59Z'}))"
```

### Linking tasks to events (dependencies)

Links connect any two records by id. Use a `type` string to describe the relationship.

```bash
# Create the task and capture its id
node scripts/browser.js exec eval "JSON.stringify(agentAPI.tasks.create({title: 'Prep slides for kickoff'}))"

# Create the event and capture its id
node scripts/browser.js exec eval "JSON.stringify(agentAPI.events.create({title: 'Acme kickoff call', start: '2026-01-05T15:00:00Z'}))"

# Link them
node scripts/browser.js exec eval "JSON.stringify(agentAPI.links.create({from: 'tsk_...', to: 'evt_...', type: 'scheduled-for'}))"

# Find everything linked to a task
node scripts/browser.js exec eval "JSON.stringify(agentAPI.links.list({from: 'tsk_...'}))"
```

Common link types: `"scheduled-for"`, `"blocked-by"`, `"blocks"`, `"related-to"`, `"part-of"`. The `type` is a free-form string — pick whatever is meaningful for the workflow.

### Searching across all entities

Global search returns matching tasks, events, and sessions in one call.

```bash
node scripts/browser.js exec eval "JSON.stringify(agentAPI.search('acme'))"
# → {"tasks":[...],"events":[...],"sessions":[...]}
```

Use this before creating a duplicate — search for the topic first to find existing records to update or link.

### Managing custom task states

The default states are `["backlog", "todo", "in-progress", "done"]`. Override them for your workflow (e.g. add a review step):

```bash
node scripts/browser.js exec eval "agentAPI.config.set('taskStates', ['backlog','todo','in-progress','review','done'])"

# Read it back
node scripts/browser.js exec eval "JSON.stringify(agentAPI.config.get('taskStates'))"
```

Config is arbitrary key/value — store any workflow settings you want to persist across sessions.

### Ending a session with a summary

Always end the session when work is complete. The summary is stored on the session record and is readable by the next run.

```bash
node scripts/browser.js exec eval "JSON.stringify(agentAPI.session.end({summary: 'Created 3 tasks for Acme kickoff, scheduled call for Jan 5, linked prep task to the call. Next: send slides to client.'}))"
```

## Views

The app has four views. The API works regardless of which view is active — you rarely need to switch views to get work done. Switch views only when the user asks to see something or when you need to read view-specific LLM instructions.

| View | What it shows | What the agent can do |
|---|---|---|
| **Dashboard** | Active session, recent tasks, upcoming events, quick stats | Read the current state at a glance; start/end sessions; jump to Tasks or Calendar |
| **Tasks** | Full task list with filters by status/priority/tag/date | Create, update, delete, filter tasks; manage custom states via config |
| **Calendar** | Events on a calendar grid, optionally showing linked tasks | Create, update, delete events; filter by date range; see task→event links |
| **Shortcuts** | Reference of all keyboard shortcuts, grouped by category | Read the full shortcut list; discover available navigation and action keys |

Each view hides LLM-targeted examples in the DOM at `[data-testid="llm-instructions"]`. Read it when you land on a view:

```bash
node scripts/browser.js exec eval "document.querySelector('[data-testid=\"llm-instructions\"]').textContent"
```

## Keyboard shortcuts

The app has a full set of keyboard shortcuts for navigation and actions (ADR-0017). They are implemented with `@tanstack/react-hotkeys` and registered globally. The full list is visible in-app at the `/shortcuts` route.

### Discoverability

The app surfaces the shortcuts in three visible places so agents and humans can discover them:

1. **Dashboard banner** — a prominent, dismissible banner at the top of the Dashboard view (`[data-testid="shortcuts-hint-banner"]`) that says "Press ? to see all keyboard shortcuts" with a `?` key cap and a "View shortcuts" button. Dismissing it sets `localStorage["agent-desk-shortcuts-hint-dismissed"] = "true"`.
2. **Header badge** — a persistent `?` badge next to the app title in the header (`[data-testid="header-shortcuts-hint"]`), always visible on desktop widths (hidden on mobile).
3. **Shortcuts nav link** — a "Shortcuts" link with a keyboard icon in the header nav (`[data-testid="nav-shortcuts"]`).

Press `?` (Shift+/) at any time to navigate directly to the shortcuts reference page.

### Navigation (vim-style sequences)

Press the first key, then the second within 1 second:

| Keys | Action |
|---|---|
| `g d` | Go to Dashboard |
| `g t` | Go to Tasks |
| `g c` | Go to Calendar |
| `g s` | Go to Shortcuts |
| `Esc` | Back to Dashboard |

### Actions

| Keys | Action |
|---|---|
| `?` | Show shortcuts (navigate to /shortcuts) |
| `n t` | New task (navigates to Tasks + opens dialog) |
| `n e` | New event (navigates to Calendar + opens dialog) |
| `s` | Start session |
| `x` | End session |
| `t` | Toggle theme |
| `Mod+E` | Export backup (Cmd+E on Mac, Ctrl+E elsewhere) |
| `Mod+I` | Import backup (Cmd+I on Mac, Ctrl+I elsewhere) |

### Triggering shortcuts via eval (CustomEvents)

Agents can trigger the same actions without pressing keys by dispatching CustomEvents on `window`. This is useful when the agent wants to open a dialog or toggle the theme programmatically:

```bash
# Open the new task dialog (navigates to /tasks first)
node scripts/browser.js exec eval "window.dispatchEvent(new CustomEvent('agent-desk:new-task'))"

# Open the new event dialog (navigates to /calendar first)
node scripts/browser.js exec eval "window.dispatchEvent(new CustomEvent('agent-desk:new-event'))"

# Toggle light/dark theme
node scripts/browser.js exec eval "window.dispatchEvent(new CustomEvent('agent-desk:toggle-theme'))"

# Trigger export backup download
node scripts/browser.js exec eval "window.dispatchEvent(new CustomEvent('agent-desk:export-backup'))"

# Trigger import backup file picker
node scripts/browser.js exec eval "window.dispatchEvent(new CustomEvent('agent-desk:import-backup'))"
```

### Reading the shortcuts list from the DOM

The shortcuts view at `/shortcuts` renders the full list with `data-testid` attributes for each row:

```bash
# Navigate to shortcuts
node scripts/browser.js exec eval "window.location.hash = '#/shortcuts'"

# Read all shortcut rows
node scripts/browser.js exec eval "JSON.stringify(Array.from(document.querySelectorAll('[data-testid^=\"shortcut-row-\"]').map(r => r.textContent)))"
```

## Reference index

- [references/api-reference.md](references/api-reference.md) — Complete API reference: every method, parameter, return type, and record schema for all 6 namespaces.
- [references/examples.md](references/examples.md) — Real-world workflow examples (project management, CRM, daily planning, sprint planning, research tracking, session continuity) with the exact `eval` commands to run.
