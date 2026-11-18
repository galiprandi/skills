---
name: lever
description: Automate job applications on Lever-hosted career pages (jobs.lever.co), including resume upload, location autocomplete, custom question cards and hCaptcha submit flow.
verified: 2026-11-13
domains:
  - jobs.lever.co
---

# Lever Automation

Lever is an ATS used by many companies (Toptal, and others). Application forms live at `https://jobs.lever.co/<company>/<posting-uuid>/apply`. The form is a classic multipart POST (`#application-form`) enhanced with React-style controlled inputs, an async resume parser, a location autocomplete and hCaptcha.

## Prerequisite

Read the parent `SKILL.md` for golden rules and the browser wrapper. All commands below assume `node .agents/skills/browser-automation/scripts/browser.js` from the repo root.

## Setup

```bash
node .agents/skills/browser-automation/scripts/browser.js open "https://jobs.lever.co/<company>/<uuid>/apply" --headed
```

Headed is recommended: the final step requires solving an hCaptcha challenge, which is a human barrier (never solve programmatically — fill everything, trigger submit, stop, ask the user).

## Keyboard shortcuts

Investigated 2026-11-13: the Lever apply form has **no keyboard shortcuts**. Tab/Enter work as native form controls only.

## Form structure

All fields are plain inputs inside `#application-form`. Discover exact names at runtime — the custom-question card UUID changes per posting:

```bash
# List every field with name/type/required
node .agents/skills/browser-automation/scripts/browser.js exec eval "JSON.stringify([...document.querySelectorAll('#application-form input,#application-form textarea,#application-form select')].map(e=>({tag:e.tagName,type:e.type,name:e.name,req:e.required})))"
```

Standard fields (stable names):

| Field | Selector |
|---|---|
| Resume | `#resume-upload-input` (type=file) |
| Full name | `input[name=name]` (required) |
| Email | `input[name=email]` (required) |
| Phone | `input[name=phone]` |
| Location | `#location-input` + hidden `#selected-location` |
| Current company | `input[name=org]` |
| LinkedIn | `input[name='urls[LinkedIn Profile]']` |
| Portfolio | `input[name='urls[Personal Website or Portfolio]']` |
| GitHub | `input[name='urls[Github]']` |
| Custom questions | `textarea[name='cards[<uuid>][fieldN]']`, `input[type=radio][name='cards[<uuid>][fieldN]']` |
| Education | radio group inside the cards section |
| Submit | `#btn-submit` (type=button, triggers hCaptcha) |

## Core flow

### 1. Upload resume first

```bash
node .agents/skills/browser-automation/scripts/browser.js exec upload "#resume-upload-input" "<path-to-cv.pdf>"
```

Then wait ~3-5s and verify `Success!` appears in the Resume/CV section. The parser (`parseResume.js`) auto-fills `org` and other fields from the CV — check and correct `org` afterwards if it picked the wrong employer.

```bash
# Verify attachment (input.files survives only until form reload — see anti-patterns)
node .agents/skills/browser-automation/scripts/browser.js exec eval "document.querySelector('#resume-upload-input').files.length"
```

### 2. Fill standard fields

```bash
node .agents/skills/browser-automation/scripts/browser.js exec fill "input[name=name]" "<full name>"
node .agents/skills/browser-automation/scripts/browser.js exec fill "input[name=email]" "<email>"
node .agents/skills/browser-automation/scripts/browser.js exec fill "input[name=phone]" "<phone>"
node .agents/skills/browser-automation/scripts/browser.js exec fill "input[name=org]" "<current company>"
```

### 3. Location autocomplete

`#location-input` is backed by `GET /searchLocations?text=<query>` which returns `[{"name":"City, CC", "id":"<hash>"}]`. Picking a result sets the visible input AND the hidden `#selected-location` to `JSON.stringify(result)`.

**Programmatic fill (validated):** set both fields with the native value setter + `input` event. Do NOT use plain `.value=` — React-style handlers ignore it:

```bash
node .agents/skills/browser-automation/scripts/browser.js exec eval "(()=>{const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;const i=document.querySelector('#location-input');s.call(i,'<location name>');i.dispatchEvent(new Event('input',{bubbles:true}));const h=document.querySelector('#selected-location');s.call(h,JSON.stringify({name:'<location name>',id:'<id from /searchLocations>'}));h.dispatchEvent(new Event('input',{bubbles:true}));return 'ok'})()"
```

Get valid `name`/`id` pairs first:

```bash
node .agents/skills/browser-automation/scripts/browser.js exec eval "fetch('/searchLocations?text=<query>').then(r=>r.text())"
```

### 4. Custom question cards

Cards use `cards[<uuid>][fieldN]` names — read the question text from the DOM to map fieldN → question, then fill textareas and click radios:

```bash
# Read all questions in order
node .agents/skills/browser-automation/scripts/browser.js exec eval "JSON.stringify([...document.querySelectorAll('.application-question, [class*=question]')].map(e=>e.innerText.slice(0,200)))"

# Fill a textarea (native setter + input event)
node .agents/skills/browser-automation/scripts/browser.js exec eval "(()=>{const s=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;const e=document.querySelector('textarea[name=\"cards[<uuid>][field0]\"]');s.call(e,'<answer>');e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return e.value.length})()"

# Click a radio by value
node .agents/skills/browser-automation/scripts/browser.js exec eval "[...document.querySelectorAll('input[type=radio]')].find(r=>r.value==='<option text>').click()"
```

### 5. Verify before submit

```bash
node .agents/skills/browser-automation/scripts/browser.js exec eval "JSON.stringify({emptyRequired:[...document.querySelectorAll('input[required],textarea[required]')].filter(e=>!e.value.trim()).map(e=>e.name),resumeFiles:document.querySelector('#resume-upload-input').files.length,form:new FormData(document.getElementById('application-form')).get('resume')instanceof File})"
```

All required fields filled, resume attached, no errors → proceed.

### 6. Submit + hCaptcha (human barrier)

Clicking `#btn-submit` runs invisible hCaptcha: on success it fills `#hcaptchaResponseInput` and clicks the hidden `#hcaptchaSubmitBtn`, which performs a native multipart POST (full page reload). If a challenge appears, the user must solve it — stop and hand over (see SKILL.md human-barrier protocol; use the `remote-desktop` skill (VNC tunnel) for remote access or reopen `--headed` for local desktop).

```bash
node .agents/skills/browser-automation/scripts/browser.js exec eval "document.getElementById('btn-submit').click()"
```

Success = redirect to a confirmation page (no form). Failure = page reloads with `There was an error verifying your application. Please try again.` at the top — see anti-patterns for causes.

## API reference

| Endpoint | Method | Purpose |
|---|---|---|
| `/searchLocations?text=<query>` | GET | Location autocomplete, returns `[{name, id}]` |
| `#application-form` POST (same URL) | POST multipart | Submit application; fields per table above |

The form also posts hidden fields: `resumeStorageId` (set by the resume parser), `h-captcha-response`, `accountId`, `origin`, `referer`, `timezone`, `source`. Do not fabricate them — let the page JS set them.

## Anti-patterns

**Bad pattern:** Fill the form once, submit, and assume everything persists across failed attempts.
**Why it fails:** Each failed submit reloads the page. `input[type=file]` CANNOT be repopulated programmatically after reload — the resume silently disappears. The location fields also get wiped (see below).
**Workaround:** After EVERY failed submit, re-verify `files.length` on the resume input and re-upload if 0. Re-check location/phone/org too — treat post-reload state as a fresh form.

**Bad pattern:** Set `#location-input` value with plain `.value=` or `fill`, then move on.
**Why it fails:** `retrieveLocations.js` binds a `blur` handler that clears BOTH the visible input and `#selected-location` when the field loses focus without a dropdown selection. Clicking the captcha or any other field wipes the location.
**Workaround:** Use the native-setter + `input`-event snippet above (sets hidden `#selected-location` too). If the user must edit it manually, have them pick from the dropdown — never let them type-and-blur.

**Bad pattern:** Interpret `There was an error verifying your application` as a transient error and retry blindly.
**Why it fails:** This message covers every server-side rejection. Validated cause: **duplicate applications** — Lever rejects re-applying with an email that already applied to the same posting (common with evergreen/reposted jobs that get new posting UUIDs). Retrying burns captcha solves and time.
**Workaround:** Before starting ANY Lever application, check your applications database for the same company+role. If a prior application exists, skip — a reposted evergreen funnel will keep rejecting. Only retry after a genuine hCaptcha expiry (solve again immediately before submit).

**Bad pattern:** Navigate the "current" tab away mid-flow to check something else.
**Why it fails:** `exec` commands without `--tab` act on whatever tab is current; a `goto` on that tab destroys the filled form (React state is in-memory).
**Workaround:** Always pass `--tab <label>` for multi-tab sessions, and open lookups in a NEW tab (`tab-new`), never reuse the application tab.

**Bad pattern:** Assume `org`/profile fields you filled are still there at submit time.
**Why it fails:** `parseResume.js` re-analyzes the CV after upload and can overwrite `org` with a different employer from the work history.
**Workaround:** Upload resume FIRST, wait for `Success!`, then fill/verify `org` and the rest.

## Validation date

Validated 2026-11-13 against a live Toptal CTO posting on jobs.lever.co (headless Chrome via wrapper, headed for captcha).
