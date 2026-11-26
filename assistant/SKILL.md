---
name: assistant
description: Personal assistant data-management doctrine. Use when managing people/contact data, deciding where contact fields belong, deduplicating people, using Google Contacts as the source of truth, or falling back to CSV when Google is unavailable. Defines semantics and safety rules; use browser-automation for UI mechanics.
---

# Assistant

Operating doctrine for personal-assistant bots. This skill defines **what data means, where it belongs, and when writes are safe**. It does not teach browser clicks or UI mechanics; when operating Google through a browser, use `browser-automation` in parallel.

## Section standard

Every future domain section must be concrete and information-dense. It must define:

1. source of truth;
2. fallback system;
3. field ownership/mapping;
4. normalization rules;
5. deduplication rules;
6. write-safety rules;
7. migration/reconciliation rules;
8. explicit non-goals.

Do not add vague routines. If a section cannot define those points, it is not ready.

## Contact management

### Source-of-truth hierarchy

1. **Google Contacts available and authenticated** → Google Contacts is the only source of truth.
2. **Google Contacts unavailable** → CSV fallback is the temporary source of truth.
3. **Google Contacts becomes available again** → reconcile/import the CSV once, verify, then return to Google Contacts as the only source of truth.
4. **Never** maintain Google Contacts and the CSV as competing active databases.

Before writing, determine the state: `google_active`, `csv_fallback`, or `reconcile_required`. If the state is unclear, inspect before acting.

### Core invariant

If Google Contacts is available, do not store contact data in memory, notes, ad-hoc files, inboxes, spreadsheets, or chat transcripts. Use Google Contacts. The CSV exists only for contingency and controlled migration.

### Field ownership

| Data | Google Contacts target | CSV fallback column(s) | Rules |
|---|---|---|---|
| Full name | Name fields | `full_name`, `given_name`, `family_name` | Preserve user spelling. Split given/family only when clear; do not invent middle names. |
| Nickname / alias | Nickname field if available | `nickname` | Do not use nickname as the primary legal name. |
| Email addresses | Email fields with type when clear | `email_primary`, `email_secondary` | Trim and lowercase. Preserve additional emails rather than overwriting. |
| Phone numbers | Phone fields with type when clear | `phone_mobile`, `phone_work`, `phone_home` | Normalize to international/E.164 only when country is known or explicit; otherwise preserve input exactly. |
| Postal addresses | Address fields with type when clear | `address_home`, `address_work` | Do not merge incomplete fragments into a false complete address. |
| Organization / role | Organization and title fields | `organization`, `job_title` | Keep employer and role separate. |
| DNI/CUIT/passport/other ID | Custom field named after the document type when supported | `document_type`, `document_number` | Never discard leading zeros. Never silently reformat. Prefer a custom field over notes. |
| Birth date | Birthday/significant date field | `birth_date` | Use `YYYY-MM-DD` only when the full date is known. |
| Birthday without year | Birthday/significant date field if supported | `birthday_day`, `birthday_month` | Use only when year is unknown. Do not duplicate a birthday already derivable from `birth_date`. |
| Relationship | Relationship field if supported | `notes` or future structured column | Examples: spouse, assistant, accountant, lawyer. Do not infer sensitive relationships. |
| Labels/groups | Existing contact labels/groups | `labels` | Prefer existing labels. Avoid near-duplicate labels such as `client`, `clients`, `customer`. |
| Context | Notes field | `notes` | Brief operational context only. No document scans, long transcripts, secrets, or unnecessary sensitive data. |
| Google linkage | Native Google contact identity | `google_contact_id`, `sync_status` | CSV-only metadata used for reconciliation; not part of the person’s public contact data. |

### CSV fallback schema

Use the header from `templates/contacts-fallback.csv` exactly. Default local path: `./contacts-fallback.csv` unless the user or workspace defines another path.

Key rules:

- `contact_id` is the fallback row’s stable internal ID; never use DNI, email, or phone as the primary key because they can be missing or change.
- `document_type` examples: `DNI`, `CUIT`, `PASSPORT`, `OTHER`.
- `birth_date` format: `YYYY-MM-DD`; empty if unknown.
- `birthday_day`/`birthday_month` are only for partial birthdays without a known year.
- `labels` is a semicolon-separated list.
- `sync_status` values: `pending`, `synced`, `conflict`, `not_applicable`.
- `created_at`/`updated_at` use ISO 8601 UTC when available.
- A real populated CSV may contain sensitive personal data. Never commit it; keep it local or in the user-approved private location.

### Deduplication and matching

Always search before creating or updating.

Match strength:

- **Strong match:** exact document number, exact normalized email, exact normalized phone, or full name plus corroborating data such as birth date/organization.
- **Weak match:** similar name only, partial phone, shared surname, or incomplete evidence.
- **No match:** no strong or weak candidates.

Actions:

- One strong match → update that contact.
- No match → create a new contact.
- Multiple strong matches → stop and ask; possible duplicates.
- Only weak matches → ask before creating or updating.
- Never merge contacts solely because names look similar.

Normalize comparison case-insensitively and ignore accents/extra whitespace when comparing names, but preserve the original spelling in stored data.

### Write-safety rules

1. Read/search before writing.
2. Do not overwrite an existing email, phone, address, document number, or birth date silently.
3. If the new value conflicts with an existing value and the user did not explicitly call it a correction, add it as secondary or ask.
4. Ask before deleting, merging, exporting, importing, sharing, or bulk-updating contacts.
5. Ask before storing especially sensitive data when the purpose is unclear: identity documents, tax IDs, health data, financial data, precise home address, or family relationships.
6. After writing, re-read or otherwise verify the record and report exactly what changed.
7. If the interface does not expose the correct field, do not stuff the data into the wrong field. Use an appropriate custom field, leave it in the CSV fallback, or ask.

### CSV → Google migration

When Google Contacts becomes available after CSV use:

1. Preserve the fallback CSV unchanged as pre-migration backup.
2. Reconcile duplicates before importing or manual creation.
3. For bulk migration, transform rows into the current official Google Contacts CSV import format; do not assume the fallback header is import-compatible.
4. For small batches, creation through the Google Contacts UI is acceptable; use `browser-automation` for mechanics.
5. After migration, verify counts, spot-check important fields, scan for duplicates, and resolve conflicts.
6. Mark migrated CSV rows as `synced`; mark unresolved rows as `conflict`.
7. Once verification passes, freeze the CSV as an archive. Future contact writes go only to Google Contacts.

Importing is not synchronization. Never import the same fallback CSV repeatedly without reconciliation; that creates duplicates.

### Contact non-goals

- No click-by-click browser instructions; use `browser-automation`.
- No permanent parallel CRM in CSV.
- No document/photo storage inside contacts.
- No inferring identity-document data from uncertain text.
- No automatic merging or deletion.
- No storing secrets or scanned documents in notes.
