# Workflow Examples

Real-world workflows an agent might implement with agent-desk. Each example shows the exact `eval` commands to run through the browser-automation wrapper.

**Reminder:** all API methods are synchronous. Never `await`. Always check `window.agentAPIReady` first.

```bash
# Setup (run once at the start of any workflow)
node scripts/browser.js open "https://<owner>.github.io/<repo>/" --headed
node scripts/browser.js exec eval "window.agentAPIReady"   # → true
```

---

## 1. Project management

Track a small project: tasks with dependencies, a milestone event, and links between them.

```bash
# Start a session for this project
node scripts/browser.js exec eval "JSON.stringify(agentAPI.session.start({summary: 'Setting up Website Redesign project'}))"

# Create the milestone event (launch date)
node scripts/browser.js exec eval "JSON.stringify(agentAPI.events.create({
  title: 'Website Redesign launch',
  start: '2026-03-01T09:00:00Z',
  end: '2026-03-01T17:00:00Z',
  description: 'Public launch of the redesigned site'
}))"

# Create the tasks. Capture each id from the output.
node scripts/browser.js exec eval "JSON.stringify(agentAPI.tasks.create({
  title: 'Design mockups',
  status: 'todo',
  priority: 'high',
  dueDate: '2026-02-01T17:00:00Z',
  tags: ['website-redesign', 'design']
}))"

node scripts/browser.js exec eval "JSON.stringify(agentAPI.tasks.create({
  title: 'Implement frontend',
  status: 'backlog',
  priority: 'high',
  dueDate: '2026-02-20T17:00:00Z',
  tags: ['website-redesign', 'frontend']
}))"

node scripts/browser.js exec eval "JSON.stringify(agentAPI.tasks.create({
  title: 'QA pass',
  status: 'backlog',
  priority: 'medium',
  dueDate: '2026-02-27T17:00:00Z',
  tags: ['website-redesign', 'qa']
}))"

# Link dependencies: frontend is blocked-by design, QA is blocked-by frontend
node scripts/browser.js exec eval "JSON.stringify(agentAPI.links.create({from: 'tsk_<frontend>', to: 'tsk_<design>', type: 'blocked-by'}))"
node scripts/browser.js exec eval "JSON.stringify(agentAPI.links.create({from: 'tsk_<qa>', to: 'tsk_<frontend>', type: 'blocked-by'}))"

# Link the QA task to the launch event (QA must finish before launch)
node scripts/browser.js exec eval "JSON.stringify(agentAPI.links.create({from: 'tsk_<qa>', to: 'evt_<launch>', type: 'scheduled-for'}))"

# Later: mark design done, move frontend to in-progress
node scripts/browser.js exec eval "JSON.stringify(agentAPI.tasks.update('tsk_<design>', {status: 'done'}))"
node scripts/browser.js exec eval "JSON.stringify(agentAPI.tasks.update('tsk_<frontend>', {status: 'in-progress'}))"

# Check what's left before launch
node scripts/browser.js exec eval "JSON.stringify(agentAPI.tasks.list({status: 'todo'}))"
node scripts/browser.js exec eval "JSON.stringify(agentAPI.tasks.list({status: 'in-progress'}))"

# End the session with a summary
node scripts/browser.js exec eval "JSON.stringify(agentAPI.session.end({summary: 'Set up Website Redesign: 3 tasks, 1 launch event, dependency chain design→frontend→QA. Design marked done, frontend in progress. Next: finish frontend, then QA.'}))"
```

---

## 2. CRM

Track contacts as tasks, schedule follow-up calls as events, and link them.

```bash
node scripts/browser.js exec eval "JSON.stringify(agentAPI.session.start({summary: 'CRM follow-ups for this week'}))"

# Create a contact task for a new lead
node scripts/browser.js exec eval "JSON.stringify(agentAPI.tasks.create({
  title: 'Contact: Jane Doe (Acme Corp)',
  description: 'Met at conference. Interested in enterprise plan. Decision maker.',
  status: 'todo',
  priority: 'high',
  tags: ['crm', 'lead', 'acme']
}))"

# Schedule a follow-up call and link it to the contact task
node scripts/browser.js exec eval "JSON.stringify(agentAPI.events.create({
  title: 'Follow-up call with Jane Doe',
  start: '2026-01-08T16:00:00Z',
  end: '2026-01-08T16:30:00Z',
  location: 'Phone',
  links: [{to: 'tsk_<jane>', type: 'scheduled-for'}]
}))"

# After the call: update the contact, schedule a demo
node scripts/browser.js exec eval "JSON.stringify(agentAPI.tasks.update('tsk_<jane>', {
  status: 'in-progress',
  description: 'Met at conference. Interested in enterprise plan. Had follow-up call Jan 8 — wants a demo.'
}))"

node scripts/browser.js exec eval "JSON.stringify(agentAPI.events.create({
  title: 'Demo for Acme Corp',
  start: '2026-01-15T15:00:00Z',
  end: '2026-01-15T16:00:00Z',
  location: 'Zoom',
  links: [{to: 'tsk_<jane>', type: 'scheduled-for'}]
}))"

# Find all open CRM leads
node scripts/browser.js exec eval "JSON.stringify(agentAPI.tasks.list({tag: 'crm', status: 'todo'}))"
node scripts/browser.js exec eval "JSON.stringify(agentAPI.tasks.list({tag: 'crm', status: 'in-progress'}))"

# Search everything related to Acme
node scripts/browser.js exec eval "JSON.stringify(agentAPI.search('acme'))"

node scripts/browser.js exec eval "JSON.stringify(agentAPI.session.end({summary: 'CRM week: Jane Doe lead moved to in-progress after follow-up call, demo scheduled Jan 15. Other open leads still in todo.'}))"
```

---

## 3. Daily planning

Start the day, review the dashboard, create today's tasks, schedule events, end with a summary.

```bash
# Read where we left off
node scripts/browser.js exec eval "JSON.stringify(agentAPI.session.get())"

# Start today's session
node scripts/browser.js exec eval "JSON.stringify(agentAPI.session.start({summary: 'Daily plan for 2026-01-06'}))"

# Review what's already on the plate
node scripts/browser.js exec eval "JSON.stringify(agentAPI.tasks.list({status: 'in-progress'}))"
node scripts/browser.js exec eval "JSON.stringify(agentAPI.tasks.list({status: 'todo', dueBefore: '2026-01-06T23:59:59Z'}))"
node scripts/browser.js exec eval "JSON.stringify(agentAPI.events.list({from: '2026-01-06T00:00:00Z', to: '2026-01-07T00:00:00Z'}))"

# Create today's tasks
node scripts/browser.js exec eval "JSON.stringify(agentAPI.tasks.create({
  title: 'Review PR #142',
  priority: 'high',
  dueDate: '2026-01-06T17:00:00Z',
  tags: ['code-review']
}))"

node scripts/browser.js exec eval "JSON.stringify(agentAPI.tasks.create({
  title: 'Write weekly status update',
  priority: 'medium',
  dueDate: '2026-01-06T17:00:00Z',
  tags: ['reporting']
}))"

# Schedule a focus block
node scripts/browser.js exec eval "JSON.stringify(agentAPI.events.create({
  title: 'Deep work: PR review',
  start: '2026-01-06T14:00:00Z',
  end: '2026-01-06T15:30:00Z',
  links: [{to: 'tsk_<pr>', type: 'scheduled-for'}]
}))"

# End of day: mark done, summarize
node scripts/browser.js exec eval "JSON.stringify(agentAPI.tasks.update('tsk_<pr>', {status: 'done'}))"
node scripts/browser.js exec eval "JSON.stringify(agentAPI.tasks.update('tsk_<status>', {status: 'done'}))"
node scripts/browser.js exec eval "JSON.stringify(agentAPI.session.end({summary: 'Jan 6: reviewed PR #142 (approved), wrote weekly status. Tomorrow: pick up backend refactor.'}))"
```

---

## 4. Sprint planning

Create a batch of tasks, set priorities, assign due dates, and link dependencies.

```bash
node scripts/browser.js exec eval "JSON.stringify(agentAPI.session.start({summary: 'Sprint 12 planning'}))"

# Optional: add a 'review' state to the workflow for this sprint
node scripts/browser.js exec eval "agentAPI.config.set('taskStates', ['backlog','todo','in-progress','review','done'])"
node scripts/browser.js exec eval "JSON.stringify(agentAPI.config.get('taskStates'))"

# Sprint boundary events
node scripts/browser.js exec eval "JSON.stringify(agentAPI.events.create({title: 'Sprint 12 start', start: '2026-02-03T09:00:00Z'}))"
node scripts/browser.js exec eval "JSON.stringify(agentAPI.events.create({title: 'Sprint 12 demo', start: '2026-02-14T15:00:00Z', end: '2026-02-14T16:00:00Z'}))"

# Batch of stories with priorities and due dates
node scripts/browser.js exec eval "JSON.stringify(agentAPI.tasks.create({title: 'Add OAuth login', status: 'todo', priority: 'high', dueDate: '2026-02-07T17:00:00Z', tags: ['sprint-12','auth']}))"
node scripts/browser.js exec eval "JSON.stringify(agentAPI.tasks.create({title: 'Rate-limit middleware', status: 'todo', priority: 'high', dueDate: '2026-02-07T17:00:00Z', tags: ['sprint-12','infra']}))"
node scripts/browser.js exec eval "JSON.stringify(agentAPI.tasks.create({title: 'Dashboard charts', status: 'todo', priority: 'medium', dueDate: '2026-02-12T17:00:00Z', tags: ['sprint-12','frontend']}))"
node scripts/browser.js exec eval "JSON.stringify(agentAPI.tasks.create({title: 'Write release notes', status: 'backlog', priority: 'low', dueDate: '2026-02-14T12:00:00Z', tags: ['sprint-12','docs']}))"

# Dependency: release notes blocked-by dashboard charts (need to document what shipped)
node scripts/browser.js exec eval "JSON.stringify(agentAPI.links.create({from: 'tsk_<release-notes>', to: 'tsk_<charts>', type: 'blocked-by'}))"

# Link the release notes task to the demo event
node scripts/browser.js exec eval "JSON.stringify(agentAPI.links.create({from: 'tsk_<release-notes>', to: 'evt_<demo>', type: 'scheduled-for'}))"

# Review the sprint board by status
node scripts/browser.js exec eval "JSON.stringify(agentAPI.tasks.list({tag: 'sprint-12', status: 'todo'}))"
node scripts/browser.js exec eval "JSON.stringify(agentAPI.tasks.list({tag: 'sprint-12', status: 'backlog'}))"

node scripts/browser.js exec eval "JSON.stringify(agentAPI.session.end({summary: 'Sprint 12 planned: 4 stories (2 high, 1 medium, 1 low). Added review state to workflow. Dependency: release notes blocked-by charts. Demo scheduled Feb 14.'}))"
```

---

## 5. Research tracking

Create tasks for research items, use tags to categorize, and search to find related work across sessions.

```bash
node scripts/browser.js exec eval "JSON.stringify(agentAPI.session.start({summary: 'Research: vector DB comparison'}))"

# Create research tasks tagged by topic
node scripts/browser.js exec eval "JSON.stringify(agentAPI.tasks.create({
  title: 'Benchmark pgvector vs Pinecone',
  description: 'Compare latency and cost at 1M vectors',
  status: 'in-progress',
  priority: 'high',
  tags: ['research', 'vector-db', 'benchmark']
}))"

node scripts/browser.js exec eval "JSON.stringify(agentAPI.tasks.create({
  title: 'Survey embedding models for code',
  status: 'todo',
  priority: 'medium',
  tags: ['research', 'embeddings', 'code']
}))"

node scripts/browser.js exec eval "JSON.stringify(agentAPI.tasks.create({
  title: 'Read Qdrant architecture paper',
  status: 'backlog',
  priority: 'low',
  tags: ['research', 'vector-db', 'qdrant']
}))"
```

```bash
# Find all vector-db research
node scripts/browser.js exec eval "JSON.stringify(agentAPI.tasks.list({tag: 'vector-db'}))"

# Global search across tasks, events, and sessions for prior context
node scripts/browser.js exec eval "JSON.stringify(agentAPI.search('embedding'))"
node scripts/browser.js exec eval "JSON.stringify(agentAPI.search('benchmark'))"

# Update a finding into the description
node scripts/browser.js exec eval "JSON.stringify(agentAPI.tasks.update('tsk_<benchmark>', {
  description: 'Compare latency and cost at 1M vectors. pgvector: ~12ms p99, $0 (self-hosted). Pinecone: ~8ms p99, $70/mo. See notes.',
  status: 'done'
}))"

node scripts/browser.js exec eval "JSON.stringify(agentAPI.session.end({summary: 'Vector DB research: pgvector vs Pinecone benchmarked (pgvector cheaper, Pinecone faster). Embedding model survey still open. Qdrant paper in backlog.'}))"
```

---

## 6. Session continuity

Use sessions to carry context from one run to the next. The next run reads the last session's summary to resume.

### Run 1 — start work

```bash
node scripts/browser.js exec eval "JSON.stringify(agentAPI.session.start({summary: 'Migrating auth service to OAuth'}))"

node scripts/browser.js exec eval "JSON.stringify(agentAPI.tasks.create({
  title: 'Replace session cookies with OAuth tokens',
  status: 'in-progress',
  priority: 'high',
  tags: ['auth', 'oauth', 'migration']
}))"

node scripts/browser.js exec eval "JSON.stringify(agentAPI.tasks.create({
  title: 'Update docs for new auth flow',
  status: 'todo',
  priority: 'medium',
  tags: ['auth', 'docs']
}))"

# End run 1 with a clear handoff summary
node scripts/browser.js exec eval "JSON.stringify(agentAPI.session.end({summary: 'Started OAuth migration. Token replacement task in-progress (got the middleware working, need to wire up refresh flow). Docs task still in todo. Next: finish refresh tokens, then write docs.'}))"
```

### Run 2 — resume

```bash
# Open the app and read the last session to pick up where we left off
node scripts/browser.js open "https://<owner>.github.io/<repo>/" --headed
node scripts/browser.js exec eval "window.agentAPIReady"
node scripts/browser.js exec eval "JSON.stringify(agentAPI.session.get())"
# → read summary: "...finish refresh tokens, then write docs."

# Start a new session referencing the prior one
node scripts/browser.js exec eval "JSON.stringify(agentAPI.session.start({summary: 'Resuming OAuth migration — finishing refresh tokens'}))"

# Find the in-progress task
node scripts/browser.js exec eval "JSON.stringify(agentAPI.tasks.list({status: 'in-progress', tag: 'auth'}))"

# Continue work, then update
node scripts/browser.js exec eval "JSON.stringify(agentAPI.tasks.update('tsk_<tokens>', {status: 'done'}))"
node scripts/browser.js exec eval "JSON.stringify(agentAPI.tasks.update('tsk_<docs>', {status: 'in-progress'}))"

# End with another handoff
node scripts/browser.js exec eval "JSON.stringify(agentAPI.session.end({summary: 'Finished refresh tokens. Started docs (outline done, need examples for each grant type). Next: finish docs, then coordinate deploy.'}))"
```

This pattern — start, work, end-with-summary, then read-last-session on the next run — is the recommended way to maintain continuity across runs without external memory.
