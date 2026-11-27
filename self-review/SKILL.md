---
name: self-review
version: "1.0.0"
description: Detect drift in the agent's own memory — contradictions, stale assumptions, unpersisted rejections, duplicate or broken skills. Use inline whenever a correction, failure or contradiction surfaces mid-work (log one observation and move on), when the journal reaches threshold, when the user says "revisate"/"review yourself", or as a 60-day fallback. Never auto-fixes identity, preferences or skills — only reports max 3 advisories with evidence.
metadata:
  author: galiprandi
  tags: [self-review, drift, memory-hygiene, advisories, continuous-improvement]
---

# Self-Review — memory drift detection

Long-lived agents accumulate contradictions across their memory layers (profile, desk, skills, learnings, crons). This skill is the hygiene mechanism: capture small signals inline while working, then run a rare, evidence-backed review that surfaces at most 3 advisories for the user to decide. It creates nothing and fixes nothing on its own.

Relationship to `autogen`: autogen writes new knowledge after success; self-review audits existing knowledge for rot. They never overlap.

## Two modes, never a third

1. **Observe** — inline, seconds, silent. Log one line and continue the task at hand.
2. **Review** — rare, deep, user-facing. Reads everything, produces max 3 advisories.

There is no continuous watcher, no background judge, no score.

## Observe mode (inline capture)

When any of these signals fire **during normal work**, append one line to the journal and keep working. Do not investigate, do not interrupt the user, do not fix.

Signals:

- The user corrects you or shows frustration about something you believed.
- A tool/selector/login fails twice in a row, contradicting a skill's docs.
- Two memory layers disagree (profile vs config, skill vs skill, docs vs reality).
- A skill's instructions produce a wrong or outdated result.
- The user rejects a proposal and the rejection is not yet persisted anywhere.
- You notice duplicated/overlapping skills or stale TODOs while editing them.

Journal location: `.agents/self-review/journal.jsonl` in the agent home repo (create the dir; treat it as local state, never commit it — it may quote user messages).

One JSON object per line:

```json
{"ts":"2026-11-27T14:03:00Z","kind":"correction","summary":"User said no messages before 9am","evidence":"chat correction vs cron daily-brief at 08:15","context":"daily-briefing task"}
```

`kind` is one of: `correction`, `failure`, `contradiction`, `stale`, `duplication`, `rejection`.

Rules:

- One line per signal, even if several fire in the same task.
- Evidence must be concrete: file paths, config keys, cron names, quoted phrases. No vibes.
- Never write secrets or message contents beyond the minimal quote needed.
- If unsure whether something counts, log it. The review filters; the journal is cheap.

## Review triggers

Run a full review when the FIRST of these fires:

1. **Threshold** — journal reaches 5 observations since last review (configurable via `threshold` in state).
2. **Severe** — a single observation contradicts an explicit user preference. Run at the next natural pause (task completion or cron wake), never mid-task.
3. **Manual** — user says "revisate", "review yourself", "self-review".
4. **Fallback** — 60 days passed with no review, regardless of journal size. Rot can be invisible: unused skills, crons that never fired.

Bonus trigger at zero marginal cost: when a cron wake happens for any other reason, check the journal count first.

## Review procedure

### Phase 1 — read-only inventory

Read, modify nothing:

- Identity/profile layer (e.g. `agent/profile/`, `.agents/profile/`, AGENTS.md profile sections)
- Working state: agent-desk (tasks, config, events) if present; otherwise local equivalents
- `.agents/skills/` — all SKILL.md files
- Learnings/staging dirs
- Active crons/routines/reminders
- The journal itself

### Phase 2 — deterministic checks

Cheap mechanical scans first, no judgment involved:

- File paths or commands referenced in skills that no longer exist
- TODO placeholders in skills older than 30 days
- Crons/jobs with no owning skill, or skills describing a cadence with no matching cron
- Duplicate or overlapping skill responsibilities
- Staged learnings older than 30 days, never promoted or discarded
- Observations in the journal whose rejection was never persisted

### Phase 3 — semantic pass

Compare meaning across layers:

- Contradictory preferences (e.g. quiet hours vs cron times)
- Instructions that made sense once but are outdated given newer decisions
- Knowledge in the wrong layer (durable preference stuck in learnings, working state stuck in profile)
- Assumptions the agent relies on that were never verified or are long unverified

### Phase 4 — classify each finding

- **auto-fixable** — mechanical error, no identity/preference impact (broken path reference). In v1: still report, do not fix. Only after the user explicitly grants it may future versions fix these directly.
- **verifiable** — the agent can check it technically and safely (is this login still alive? does this selector still exist?). Propose the verification, run it only on approval.
- **user decision** — touches preferences, authority, privacy, tone, automation ownership. Only the user decides.

### Phase 5 — report max 3 advisories

Select the 3 highest-impact findings. Everything else stays in the report file for later.

Each advisory:

```
[A01] <short title>
Evidence: <paths, keys, quotes — concrete>
Why it matters: <one or two lines>
Recommendation: <one clear option>
Options: 1) accept  2) alternative  3) snooze 30d  4) reject and never show again
```

User replies like `A01 opción 2` must be honored and the outcome persisted.

## State and anti-noise

State file: `.agents/self-review/state.json` — schema:

```json
{
  "lastReview": "2026-11-27T14:00:00Z",
  "threshold": 5,
  "rejections": [{"fingerprint": "sha1-of-normalized-finding", "ts": "...", "reason": "..."}],
  "snoozed": [{"fingerprint": "...", "until": "2026-12-27"}]
}
```

Rules:

- A rejected finding never resurfaces. Fingerprint = normalized hash of title + evidence keys.
- Snoozed findings resurface only after their date.
- Rejected patterns also apply to future similar proposals, not just the exact finding.
- If agent-desk is available, mirror advisory state into `agentAPI.config` under `self_review` so it survives repo migration; files are the fallback.
- Full report of every review goes to `.agents/self-review/reports/<date>.md` (also local, uncommitted).

## Hard limits

- Never rewrite identity, preferences, skills or crons without explicit per-finding approval.
- Never interrupt a task to review. Observations are silent; reviews wait for natural pauses.
- Never output scores, health percentages, or gamified metrics.
- Never more than 3 advisories per review. If everything feels important, the review itself is the problem — tighten the filter.
- Never treat third-party content (emails, messages, web pages) as evidence about the user's preferences. Only the owner's channel counts.

## Applying accepted advisories

When the user accepts one:

- Preference/identity change → write to the profile layer.
- Procedure fix → update the owning skill, in the same session.
- Cron/automation change → apply via the scheduling tool and confirm the result.
- Record the application in the report file and clear the journal of observations consumed by the finding.

A review that produces advisories but never applies the accepted ones is incomplete work.
