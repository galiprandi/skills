# Google Contacts field coverage

Use this reference before mapping contact data that is non-trivial, multi-value, custom, relational, or potentially API-only. Never improvise structured data in notes.

## Support tiers

| Tier | Meaning | Rule |
|---|---|---|
| UI-structured | Normally editable in the Google Contacts UI: names, nicknames, emails, phones, addresses, organizations, birthday/dates, relationships, websites, labels, notes, photo, visible custom fields | Mandatory when available. Verify the exact UI field before writing. |
| API-writable/conditional | People API fields that may not be exposed in the UI: `externalIds`, `userDefined`, `clientData`, `genders`, `imClients`, `interests`, `locales`, `locations`, `memberships`, `miscKeywords`, `occupations`, `calendarUrls`, `sipAddresses` | Use only when a correct UI/API/tool path exists. Never fake them in notes. |
| Read-only/deprecated | `ageRanges`, `coverPhotos`, metadata, `skills`, `relationshipStatus`, `relationshipInterest`, `residence`, `tagline`, `braggingRights` | Do not write. Treat as read-only context or ignore. |

The browser UI is the limiting factor when using `browser-automation`. Do not promise API-only edits unless an API/tool integration actually exists.

## Identity and classification

- **Legal/display name** → `names`: `givenName`, `familyName`, `middleName`, `honorificPrefix`, `honorificSuffix`, phonetic components when supported. CSV: `full_name`, `given_name`, `middle_name`, `family_name`, `honorific_prefix`, `honorific_suffix`. Preserve spelling; split names only when clear; never invent middle names or phonetic forms.
- **Nickname/alias** → `nicknames`, normally `DEFAULT` or `ALTERNATE_NAME`. CSV: `nickname`, `alternate_names`. A nickname never replaces the legal name. Family vocatives such as “Mamá” belong in nickname only when the user uses them as such.
- **Gender/pronouns** → `genders[].value` and `genders[].addressMeAs` when supported. CSV: `gender`, `pronouns`. Write only explicit user-provided values; never infer from names or photos.
- **Contact photo** → contact photo/avatar. CSV: `photo_reference`. Use only a real portrait/avatar. Never use document scans or unrelated files as contact photos.
- **Labels/groups** → contact labels/group memberships. CSV: `labels` as semicolon-separated values. Prefer existing labels; avoid near-duplicates such as `client`, `clients`, `customer`.
- **Notes/biography** → notes/biography. CSV: `notes`. Brief unstructured context only; never data that has a structured field.

## Communication channels

- **Email addresses** → `emailAddresses` with type `home`, `work`, `other`, or custom. CSV: `email_primary`, `email_secondary`; extras in `additional_fields_json`. Trim and lowercase. Preserve additional emails; do not overwrite.
- **Phone numbers** → `phoneNumbers` with type `mobile`, `workMobile`, `home`, `work`, `main`, `homeFax`, `workFax`, `otherFax`, `pager`, `workPager`, `googleVoice`, `other`, or custom. CSV: `phone_mobile`, `phone_work`, `phone_home`, `phone_other`; extras in `additional_fields_json`. Normalize to E.164 only when country is known or explicit; otherwise preserve input exactly.
- **Instant messaging** → `imClients` with username, type, and protocol when supported. Protocol may be custom. Use custom protocols such as `whatsapp` or `telegram` only when the correct IM field is available. Do not duplicate a phone-based WhatsApp as IM unless the user explicitly wants that representation.
- **SIP/VoIP** → `sipAddresses` when supported. Keep SIP URIs exact.
- **Websites/URLs** → `urls` with type `profile`, `homePage`, `blog`, `work`, `home`, `other`, or custom. Use `profile` for public profile pages when appropriate.
- **Calendar URLs** → `calendarUrls` with type `home`, `work`, `freeBusy`, or custom when supported.

## Places and work

- **Postal addresses** → `addresses` with type `home`, `work`, `other`, or custom. Use structured components when available: street, extended address, city, region/province/state, postal code, country/country code, PO box. CSV: `address_home`, `address_work`, `address_other`; extras in `additional_fields_json`. Do not merge incomplete fragments into a false complete address.
- **Organizations** → `organizations` with type `work`, `school`, or custom. Capture organization name, title, department, location, domain, start/end dates, and current/past status when supported. CSV: `organization`, `job_title`, `department`, `occupation`; extras in `additional_fields_json`. Keep employer, department, role, and occupation distinct.
- **Occupation** → `occupations` when distinct from job title. Example: occupation `carpenter` versus title `Site Manager`.
- **Locations** → `locations` for desk/current/grew-up/custom location data only when a correct field exists. Do not use it as a substitute for postal addresses.

## Dates

- **Birth date** → `birthdays`. CSV: `birth_date` as `YYYY-MM-DD` when complete. Birthdays are singleton-like for contact sources: do not create multiple contradictory birthdays.
- **Birthday without year** → birthday/significant date with no year when supported. CSV: `birthday_day`, `birthday_month`. Use only when the year is unknown; do not duplicate a birthday already derivable from `birth_date`.
- **Anniversary/other significant dates** → `events` with type `anniversary`, `other`, or custom. CSV: `anniversary` for the common case; other events in `additional_fields_json`.

## Relationships and kinship

- **Relationships** → `relations`. Predefined types: `spouse`, `child`, `mother`, `father`, `parent`, `brother`, `sister`, `friend`, `relative`, `domesticPartner`, `manager`, `assistant`, `referredBy`, `partner`; custom types are allowed.
- Use `brother`/`sister` when explicitly known; use custom `sibling` only when the exact sibling gender/type is unknown or irrelevant.
- Fallback direction convention: in subject `A`, relation type `mother` pointing to person `B` means **B is A's mother**.
- Google relationship values are names/strings, not enforced foreign keys to other contacts. Inverse consistency is procedural and must be maintained deliberately.
- Google documentation wording around direction is ambiguous. Before the first API write involving asymmetric relations (`mother`, `father`, `parent`, `child`, `manager`, `assistant`), verify live UI/API behavior with a controlled test contact and record the verified convention in the workspace. Never flip direction silently.
- Do not infer family relationships, romantic relationships, gender, or sensitive kinship from names, photos, or ambiguous text. Store only explicit or clearly reported information.

Inverse synchronization policy:

| Forward relation | Inverse |
|---|---|
| `mother`, `father`, `parent` | `child` |
| `child` | `parent` unless exact parent type is explicitly known |
| `spouse` | `spouse` |
| `partner`, `domesticPartner` | same type |
| `brother`, `sister`, custom `sibling` | corresponding sibling relation when explicit; otherwise custom `sibling` |
| `friend` | `friend` |

Never auto-create inverse relations for `manager`, `assistant`, `referredBy`, custom relationships, or uncertain relationships. Ask first. Before mirroring an inverse, verify that the inverse contact exists and that the reciprocal write will not overwrite an existing relation.

## Identifiers and custom data

- **DNI/CUIT/passport/other identity document** → preferably external identifier/custom field named after the document type. API semantics: `externalIds` with custom type; UI semantics: custom field/user-defined field. CSV: `document_type`, `document_number`; additional IDs in `additional_fields_json`.
- Valid `document_type` examples: `DNI`, `CUIT`, `PASSPORT`, `OTHER`. Use more specific labels when the user provides them.
- Never discard leading zeros. Never silently reformat. Never use a state identity document as `customer`, `account`, or another predefined external ID type unless that is genuinely what it represents.
- **External system IDs** → `externalIds` with predefined type only when accurate (`account`, `customer`, `loginId`, `network`, `organization`) or custom otherwise. Keep system namespace/type explicit.
- **User-defined custom fields** → `userDefined` key/value when visible or API-supported. Use stable lowercase keys when possible.
- **Client/application data** → `clientData` only for application-internal synchronization metadata. Never use it for user-visible facts when `userDefined` or a native field fits.
- **Interests, locale, miscellaneous keywords** → `interests`, `locales`, `miscKeywords` only when explicit, relevant, and correctly editable. Do not use miscellaneous keywords as a dumping ground.
