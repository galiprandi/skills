# API Reference

Complete reference for `window.agentAPI`. All methods are **synchronous** — they return values, not Promises. Never `await` them.

Call via the browser-automation wrapper:

```bash
node scripts/browser.js exec eval "JSON.stringify(agentAPI.tasks.list())"
```

Always confirm the API is ready first:

```bash
node scripts/browser.js exec eval "window.agentAPIReady"   # → true
```

## Conventions

- **IDs** are strings prefixed by entity: `tsk_`, `evt_`, `ses_`, `lnk_`.
- **Dates** are ISO 8601 strings (e.g. `"2026-01-15T17:00:00Z"`). Use UTC (`Z`) for consistency.
- **All create/update methods return the full record** as it was persisted (with generated `id`, `createdAt`, etc.).
- **Update methods return `null`** if the id doesn't exist.
- **Delete methods return `true`** on success, `false` if the id wasn't found.
- **Filters are all optional** and combine with AND. Omit a filter to ignore it.

---

## tasks

Work items with status, priority, due date, and tags.

### `agentAPI.tasks.create(input)` → `TaskRecord`

Creates a new task. `title` is required; everything else is optional.

| Parameter | Type | Required | Default | Notes |
|---|---|---|---|---|
| `title` | `string` | yes | — | Task title |
| `description` | `string` | no | `""` | Long-form description |
| `status` | `string` | no | `"todo"` | Must be one of the configured `taskStates` |
| `priority` | `"low" \| "medium" \| "high" \| "urgent"` | no | `"medium"` | |
| `dueDate` | `string` (ISO) | no | `null` | When the task is due |
| `tags` | `string[]` | no | `[]` | Free-form tags |
| `links` | `LinkInput[]` | no | `[]` | Links to create alongside the task |

```bash
node scripts/browser.js exec eval "JSON.stringify(agentAPI.tasks.create({
  title: 'Send invoice to Acme',
  description: 'Q1 consulting invoice',
  status: 'todo',
  priority: 'high',
  dueDate: '2026-01-15T17:00:00Z',
  tags: ['billing', 'acme']
}))"
# → {"id":"tsk_1","title":"Send invoice to Acme","description":"Q1 consulting invoice",
#    "status":"todo","priority":"high","dueDate":"2026-01-15T17:00:00Z",
#    "tags":["billing","acme"],"createdAt":"2026-01-02T10:00:00Z","updatedAt":"2026-01-02T10:00:00Z"}
```

### `agentAPI.tasks.update(id, patch)` → `TaskRecord | null`

Updates any subset of fields on a task. Only the fields you pass are changed; omitted fields are left untouched. Returns the updated record, or `null` if the id doesn't exist.

| Parameter | Type | Required | Notes |
|---|---|---|---|
| `id` | `string` | yes | Task id (`tsk_...`) |
| `patch.title` | `string` | no | |
| `patch.description` | `string` | no | |
| `patch.status` | `string` | no | Must be a configured state |
| `patch.priority` | `"low" \| "medium" \| "high" \| "urgent"` | no | |
| `patch.dueDate` | `string` (ISO) \| `null` | no | Pass `null` to clear |
| `patch.tags` | `string[]` | no | Replaces the entire tags array |
| `patch.links` | `LinkInput[]` | no | Replaces links on the task |

```bash
node scripts/browser.js exec eval "JSON.stringify(agentAPI.tasks.update('tsk_1', {status: 'in-progress', priority: 'urgent'}))"
```

### `agentAPI.tasks.delete(id)` → `boolean`

Deletes a task. Returns `true` on success, `false` if not found. Links referencing the task are also removed.

```bash
node scripts/browser.js exec eval "agentAPI.tasks.delete('tsk_1')"
# → true
```

### `agentAPI.tasks.get(id)` → `TaskRecord | null`

Returns a single task by id, or `null` if not found.

```bash
node scripts/browser.js exec eval "JSON.stringify(agentAPI.tasks.get('tsk_1'))"
```

### `agentAPI.tasks.list(filters?)` → `TaskRecord[]`

Returns tasks matching all provided filters. With no filters, returns every task.

| Filter | Type | Notes |
|---|---|---|
| `status` | `string` | Exact match against a configured state |
| `priority` | `"low" \| "medium" \| "high" \| "urgent"` | Exact match |
| `tag` | `string` | Returns tasks that include this tag |
| `dueBefore` | `string` (ISO) | Tasks with `dueDate` before this instant |
| `dueAfter` | `string` (ISO) | Tasks with `dueDate` at or after this instant |

```bash
node scripts/browser.js exec eval "JSON.stringify(agentAPI.tasks.list({status: 'in-progress', priority: 'high', dueBefore: '2026-01-31T23:59:59Z'}))"
```

### `agentAPI.tasks.search(query)` → `TaskRecord[]`

Full-text search across task titles and descriptions. Returns matching tasks.

```bash
node scripts/browser.js exec eval "JSON.stringify(agentAPI.tasks.search('invoice'))"
```

---

## events

Calendar items with a start time and optional end time.

### `agentAPI.events.create(input)` → `EventRecord`

Creates a new event. `title` and `start` are required.

| Parameter | Type | Required | Default | Notes |
|---|---|---|---|---|
| `title` | `string` | yes | — | Event title |
| `description` | `string` | no | `""` | |
| `start` | `string` (ISO) | yes | — | Start instant |
| `end` | `string` (ISO) | no | `null` | End instant; omit or `null` for a point-in-time event |
| `allDay` | `boolean` | no | `false` | If true, `start`/`end` are treated as dates |
| `location` | `string` | no | `""` | Free-form location text |
| `links` | `LinkInput[]` | no | `[]` | Links to create alongside the event |

```bash
node scripts/browser.js exec eval "JSON.stringify(agentAPI.events.create({
  title: 'Acme kickoff call',
  start: '2026-01-05T15:00:00Z',
  end: '2026-01-05T15:30:00Z',
  location: 'Zoom'
}))"
```

### `agentAPI.events.update(id, patch)` → `EventRecord | null`

Updates any subset of fields. Returns the updated record, or `null` if not found.

| Parameter | Type | Required | Notes |
|---|---|---|---|
| `id` | `string` | yes | Event id (`evt_...`) |
| `patch.title` | `string` | no | |
| `patch.description` | `string` | no | |
| `patch.start` | `string` (ISO) | no | |
| `patch.end` | `string` (ISO) \| `null` | no | Pass `null` to clear |
| `patch.allDay` | `boolean` | no | |
| `patch.location` | `string` | no | |
| `patch.links` | `LinkInput[]` | no | Replaces links on the event |

```bash
node scripts/browser.js exec eval "JSON.stringify(agentAPI.events.update('evt_1', {location: 'Google Meet', end: '2026-01-05T16:00:00Z'}))"
```

### `agentAPI.events.delete(id)` → `boolean`

Deletes an event. Returns `true` on success, `false` if not found. Links referencing the event are also removed.

```bash
node scripts/browser.js exec eval "agentAPI.events.delete('evt_1')"
```

### `agentAPI.events.get(id)` → `EventRecord | null`

Returns a single event by id, or `null` if not found.

```bash
node scripts/browser.js exec eval "JSON.stringify(agentAPI.events.get('evt_1'))"
```

### `agentAPI.events.list(filters?)` → `EventRecord[]`

Returns events sorted by `start` ascending. With no filters, returns all events.

| Filter | Type | Notes |
|---|---|---|
| `from` | `string` (ISO) | Events with `start` at or after this instant |
| `to` | `string` (ISO) | Events with `start` before this instant |

```bash
node scripts/browser.js exec eval "JSON.stringify(agentAPI.events.list({from: '2026-01-01T00:00:00Z', to: '2026-02-01T00:00:00Z'}))"
```

---

## session

Work sessions for continuity across runs. Only one session is active at a time.

### `agentAPI.session.start(input)` → `SessionRecord`

Starts a new session. If a session is already active, it is ended first (without a summary). Returns the new session.

| Parameter | Type | Required | Default | Notes |
|---|---|---|---|---|
| `summary` | `string` | no | `""` | Initial summary; usually set when ending instead |

```bash
node scripts/browser.js exec eval "JSON.stringify(agentAPI.session.start({summary: 'Working on Acme invoice'}))"
```

### `agentAPI.session.end(input?)` → `SessionRecord | null`

Ends the currently active session, recording the summary. Returns the ended session, or `null` if no session was active.

| Parameter | Type | Required | Default | Notes |
|---|---|---|---|---|
| `summary` | `string` | no | `""` | Final summary of what was done and what's next |

```bash
node scripts/browser.js exec eval "JSON.stringify(agentAPI.session.end({summary: 'Created invoice task, scheduled kickoff call. Next: send slides.'}))"
```

### `agentAPI.session.get()` → `SessionRecord | null`

Returns the most recent session (active or ended), or `null` if there are no sessions. Use this at the start of a run to read the previous session's summary and resume.

```bash
node scripts/browser.js exec eval "JSON.stringify(agentAPI.session.get())"
```

---

## links

Relationships between any two records (task↔task, task↔event, event↔event, etc.). The `type` is a free-form string describing the relationship.

### `agentAPI.links.create(input)` → `LinkRecord`

Creates a directed link from one record to another.

| Parameter | Type | Required | Notes |
|---|---|---|---|
| `from` | `string` | yes | Source record id |
| `to` | `string` | yes | Target record id |
| `type` | `string` | yes | Relationship type (e.g. `"scheduled-for"`, `"blocked-by"`, `"blocks"`, `"related-to"`, `"part-of"`) |

```bash
node scripts/browser.js exec eval "JSON.stringify(agentAPI.links.create({from: 'tsk_1', to: 'evt_2', type: 'scheduled-for'}))"
```

### `agentAPI.links.delete(id)` → `boolean`

Deletes a link. Returns `true` on success, `false` if not found.

```bash
node scripts/browser.js exec eval "agentAPI.links.delete('lnk_1')"
```

### `agentAPI.links.list(filters?)` → `LinkRecord[]`

Returns links matching the provided filters. With no filters, returns all links.

| Filter | Type | Notes |
|---|---|---|
| `from` | `string` | Links whose `from` is this id |
| `to` | `string` | Links whose `to` is this id |

```bash
# Everything linked from a task
node scripts/browser.js exec eval "JSON.stringify(agentAPI.links.list({from: 'tsk_1'}))"

# Everything pointing at an event
node scripts/browser.js exec eval "JSON.stringify(agentAPI.links.list({to: 'evt_2'}))"
```

---

## config

Arbitrary key/value configuration persisted in IndexedDB. Used for workflow settings like custom task states.

### `agentAPI.config.get(key)` → `unknown | undefined`

Returns the stored value for `key`, or `undefined` if not set.

```bash
node scripts/browser.js exec eval "JSON.stringify(agentAPI.config.get('taskStates'))"
# → ["backlog","todo","in-progress","done"]
```

### `agentAPI.config.set(key, value)` → `void`

Stores `value` under `key`. `value` must be JSON-serializable. Returns nothing.

```bash
node scripts/browser.js exec eval "agentAPI.config.set('taskStates', ['backlog','todo','in-progress','review','done'])"
```

### Known config keys

| Key | Type | Default | Notes |
|---|---|---|---|
| `taskStates` | `string[]` | `["backlog", "todo", "in-progress", "done"]` | Valid values for `TaskRecord.status`. The Tasks view renders these as columns/statuses. |

Other keys may be added freely — config is a generic store.

---

## search (global)

### `agentAPI.search(query)` → `{ tasks: TaskRecord[], events: EventRecord[], sessions: SessionRecord[] }`

Full-text search across tasks, events, and sessions in one call. Returns an object with three arrays of matching records.

```bash
node scripts/browser.js exec eval "JSON.stringify(agentAPI.search('acme'))"
# → {"tasks":[...],"events":[...],"sessions":[...]}
```

Use this before creating a new record to avoid duplicates — search for the topic and update/link existing records instead.

---

## Record schemas

### `TaskRecord`

```ts
{
  id: string;            // "tsk_..."
  title: string;
  description: string;   // "" by default
  status: string;        // one of config.get("taskStates"); default "todo"
  priority: "low" | "medium" | "high" | "urgent";  // default "medium"
  dueDate: string | null;  // ISO string or null
  tags: string[];        // [] by default
  createdAt: string;     // ISO string, set on create
  updatedAt: string;     // ISO string, set on create and each update
}
```

### `EventRecord`

```ts
{
  id: string;            // "evt_..."
  title: string;
  description: string;   // "" by default
  start: string;         // ISO string (required)
  end: string | null;    // ISO string or null
  allDay: boolean;       // default false
  location: string;      // "" by default
  createdAt: string;     // ISO string
  updatedAt: string;     // ISO string
}
```

### `SessionRecord`

```ts
{
  id: string;            // "ses_..."
  summary: string;       // "" by default; set on start and/or end
  startTime: string;     // ISO string, set on start
  endTime: string | null;// ISO string when ended, null while active
  active: boolean;       // true until session.end() is called
}
```

### `LinkRecord`

```ts
{
  id: string;            // "lnk_..."
  from: string;          // source record id
  to: string;            // target record id
  type: string;          // free-form relationship type
  createdAt: string;     // ISO string
}
```

### `LinkInput` (used in `tasks.create` / `events.create` `links` arrays)

```ts
{
  to: string;            // target record id
  type: string;          // relationship type
}
```

The `from` is implied to be the record being created.

---

## Defaults

| Setting | Default value |
|---|---|
| Task states | `["backlog", "todo", "in-progress", "done"]` |
| Task priority | `"medium"` |
| Task status | `"todo"` |
| Event `allDay` | `false` |
| Session `summary` | `""` |

## Priority levels

`"low" | "medium" | "high" | "urgent"`
