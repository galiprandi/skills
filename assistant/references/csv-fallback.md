# CSV fallback and migration

The fallback is intentionally temporary and lossy. Google Contacts is the exhaustive model; CSV is only a contingency bridge and migration input.

## Files

Use these templates exactly:

- `templates/contacts-fallback.csv` — one row per person, core identity/channel/date fields plus `additional_fields_json` for overflow.
- `templates/contacts-relationships.csv` — one row per directed relationship.

Default local paths unless the user/workspace defines others:

- `./contacts-fallback.csv`
- `./contacts-relationships.csv`

A real populated CSV may contain sensitive personal data. Never commit it; keep it local or in the user-approved private location.

## `contacts-fallback.csv` rules

- `contact_id` is the fallback row’s stable internal ID; never use DNI, email, or phone as the primary key because they can be missing or change.
- `birth_date` format: `YYYY-MM-DD`; empty if unknown.
- `birthday_day`/`birthday_month` are only for partial birthdays without a known year.
- `anniversary` format: `YYYY-MM-DD` when complete; empty if unknown.
- `alternate_names` and `labels` are semicolon-separated lists.
- `additional_fields_json` must be valid JSON. Use `[]` when empty. Store overflow/multi-value/API-only fields as objects with stable keys, for example: `[{"field":"urls","type":"profile","value":"https://example.com"}]`.
- `sync_status` values: `pending`, `synced`, `conflict`, `not_applicable`.
- `created_at`/`updated_at` use ISO 8601 UTC when available.

## `contacts-relationships.csv` semantics

- Row meaning: `object_contact_id`/`object_name` is the `relation_type` of `subject_contact_id`.
- Example: subject `Germán`, type `mother`, object `Estela` means Estela is Germán's mother.
- `object_contact_id` may be empty when the related person has no contact row yet; `object_name` is then required.
- `inverse_relation_type` is the expected reciprocal type when known.
- `inverse_status` values: `pending`, `mirrored`, `conflict`, `not_applicable`.
- `confidence` values: `explicit`, `reported`, `uncertain`. Do not store inferred relationships as fact.
- `google_sync_status` values: `pending`, `synced`, `conflict`, `not_applicable`.

## CSV → Google migration

When Google Contacts becomes available after CSV use:

1. Preserve the fallback CSV unchanged as pre-migration backup.
2. Reconcile duplicates before importing or manual creation.
3. For bulk migration, transform rows into the current official Google Contacts CSV import format; do not assume the fallback header is import-compatible.
4. For small batches, creation through the Google Contacts UI is acceptable; use `browser-automation` for mechanics.
5. Migrate relationships after the related contacts exist; otherwise they cannot be verified consistently.
6. After migration, verify counts, spot-check important fields, scan for duplicates, and resolve conflicts.
7. Mark migrated CSV rows as `synced`; mark unresolved rows as `conflict`.
8. Once verification passes, freeze the CSV as an archive. Future contact writes go only to Google Contacts.

Importing is not synchronization. Never import the same fallback CSV repeatedly without reconciliation; that creates duplicates.
