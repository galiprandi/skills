---
name: workatastartup
description: YC Work at a Startup. Account signup, 7-step profile wizard, job apply with founder message.
---

# YC Work at a Startup — validated 2026-10-21

Prerequisite: read parent `SKILL.md`.

## Flow

- Job link → `Apply to role` → `account.ycombinator.com` signup (email, first/last, username, password).
- Wizard: About me → Location → Role → Experience (upload resume to autofill) → Skills → Career → Share → `Finish`.
- `My enrollments`/directory confirms profile live. Per-job apply opens a `dialog[open]` with a message box to the founder — fill textarea + Send. "Applied" text confirms.

## Gotchas

- Skills step multiselect (react-select): click → `type` skill name → click `[role=option]`; repeat per skill. Programmatic value-set fails.
- Radio groups register only via the label-wrapper `generic` ref, not the `input`.
- "What job type(s)" is checkboxes (Full-time/Contractor/Cofounder).
- YC profile is reusable across hundreds of startups — one-time setup.
