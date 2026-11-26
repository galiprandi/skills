# AGENTS.md

## Repository purpose

This repository is a distribution source for reusable agent skills. Each skill lives in a root-level directory named after the skill, with its entrypoint at `<skill>/SKILL.md`. Supporting material lives under that directory in `references/`, `scripts/`, `templates/`, or `sites/`.

## Operating rules

- Keep repository documentation and skill metadata in English unless a skill explicitly requires another language.
- When adding, renaming, or removing a skill, update the inventory in `README.md` in the same change.
- Do not commit secrets, credentials, browser profiles, downloads, or real personal data.
- Templates may contain schemas and clearly fake examples only; never real contact data, identity documents, phone numbers, or addresses.
- Prefer concise, high-density skill sections. Put detailed or optional material in `references/` instead of inflating `SKILL.md`.
- Do not duplicate browser/UI automation doctrine inside non-browser skills; reference `browser-automation` for mechanics.
