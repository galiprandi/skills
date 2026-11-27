---
name: assistant
description: Personal assistant data-management doctrine. Use whenever managing people/contact data, identities, relationships, addresses, emails, phones, birthdays, organizations, IDs such as DNI/CUIT/passport, custom contact fields, Google Contacts, or CSV contact fallbacks. Enforces structured use of Google Contacts, deduplication, relationship direction, and safe writes; use browser-automation for UI mechanics.
---

# Assistant

Operating doctrine for personal-assistant bots: **what data means, where it belongs, and when writes are safe**. It does not teach browser clicks or UI mechanics; when operating Google through a browser, use `browser-automation` in parallel.

## Section standard

Every future domain section must define: source of truth, fallback, field ownership/mapping, normalization, deduplication, write safety, migration/reconciliation, and explicit non-goals. Do not add vague routines.

## Contact management

### Prime directive

If a fact fits a structured Google Contacts field, **use that field**. Never improvise structured contact data in notes, memory, chat transcripts, ad-hoc spreadsheets, or free text.

Field hierarchy:

1. exact native structured field/type;
2. native structured field with custom label/type;
3. external identifier or user-defined custom field when no native field exists;
4. CSV fallback only when Google Contacts is unavailable;
5. notes/biography only for unstructured context;
6. if no correct representation exists, ask or leave unresolved — never misuse a field.

### Source of truth

1. Google Contacts available/authenticated → only source of truth.
2. Google Contacts unavailable → CSV fallback is temporary source of truth.
3. Google Contacts returns → reconcile/import CSV once, verify, then return to Google Contacts only.
4. Never maintain Google Contacts and CSV as competing active databases.

Before writing, determine state: `google_active`, `csv_fallback`, or `reconcile_required`. If unclear, inspect before acting.

### Field map

Use this summary; read `references/contact-fields.md` before mapping non-trivial, multi-value, custom, relational, sensitive, or API-only data.

| Data | Correct home |
|---|---|
| Names, nicknames, gender/pronouns, photo, labels, notes | `names`, `nicknames`, `genders`, contact photo, labels/memberships, biography/notes |
| Emails, phones, IM, SIP, websites, calendar URLs | `emailAddresses`, `phoneNumbers`, `imClients`, `sipAddresses`, `urls`, `calendarUrls` |
| Postal addresses, employers, roles, occupations, locations | `addresses`, `organizations`, `occupations`, `locations` |
| Birthdays, anniversaries, significant dates | `birthdays`, `events` |
| Kinship/relationships | `relations`; fallback relationships CSV |
| DNI/CUIT/passport/external system IDs | `externalIds` or custom/user-defined field |
| User-visible custom data / app-internal sync metadata | `userDefined` / `clientData` |
| Interests, locale, miscellaneous keywords | `interests`, `locales`, `miscKeywords` only when explicit and correctly editable |

Key limits:

- DNI/CUIT/passport is not a native standard field: use external ID/custom field, never notes.
- Relationships are directional; do not infer kinship, gender, or sensitive facts.
- Contact photos are portraits only, never document scans.
- Browser UI is the limiting factor under `browser-automation`; do not pretend API-only fields are editable without an API/tool path.

### CSV fallback

CSV is contingency and migration input, never a permanent parallel CRM. Use templates exactly:

- `templates/contacts-fallback.csv` — one row per person.
- `templates/contacts-relationships.csv` — one row per directed relationship.

Read `references/csv-fallback.md` before creating, editing, validating, or migrating fallback data. It defines required columns, JSON overflow format, relationship direction, sync statuses, and migration procedure.

### Deduplication

Always search before creating or updating.

- **Strong match:** exact document number, exact normalized email, exact normalized phone, or full name plus corroborating data.
- **Weak match:** similar name only, partial phone, shared surname, or incomplete evidence.
- One strong match → update it; no match → create; multiple strong matches or only weak matches → stop and ask.
- Never merge solely because names look similar.
- Compare names case-insensitively, ignoring accents/extra whitespace, but preserve original spelling when storing.

### Write safety

1. Read/search before writing.
2. Never overwrite existing email, phone, address, document number, birth date, relationship, photo, or custom field silently.
3. If new data conflicts and was not explicitly called a correction, add as secondary/alternate or ask.
4. Ask before deleting, merging, exporting, importing, sharing, or bulk-updating contacts.
5. Ask before storing sensitive data when purpose is unclear: identity documents, tax IDs, health/financial data, precise home address, family relationships, gender, or other sensitive attributes.
6. After writing, re-read/verify and report exactly what changed.
7. If the correct field is unavailable, use an appropriate custom field, CSV fallback, or ask — never the wrong field.
8. Never copy full contact lists or sensitive contact data into long-term memory when Google Contacts can be queried instead.

### Contact non-goals

No click-by-click browser instructions; no permanent parallel CRM in CSV; no document scans as contact photos/notes; no inferred sensitive attributes; no automatic merging/deletion; no secrets or scanned documents in notes; no pretending API-only fields are editable when only browser UI access exists.
