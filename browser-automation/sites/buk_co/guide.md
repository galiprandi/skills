---
name: buk
description: Buk HR/recruiting ATS application forms (buk.co). Fill + submit candidate applications.
---

# Buk ATS — validated 2026-10-22

Prerequisite: read parent `SKILL.md` for golden rules and the browser wrapper.

## Flow

1. Job landing page: fill `input[type=email]`, check privacy checkbox, click `Postular`.
2. Survey form opens: textbox fields (Nombre, Apellido, ID document, Fecha de Nacimiento, Celular, Ciudad, LinkedIn) + `input[type=file]` for CV + consent checkboxes.
3. Fill via `fill <ref>` per snapshot. Upload CV: `input[type=file]` click → `upload <path>`.
4. Click `Enviar Respuesta`. Verify: page shows thanks/submitted text.

## Gotchas

- Email+checkbox+Postular: button stays `disabled` until checkbox registers.
- `Identification Number` = required national ID — never invent; pull from user data.
- Form survives session resets (fields persist by email) — safe to resume.
