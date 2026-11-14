---
name: whatsapp-web-login
description: WhatsApp Web sign-in via phone-number linking (8-char code typed on the phone). Use when opening WhatsApp Web via agent-browser — works headless, no screen needed.
---

# WhatsApp Web Login Flow

Guide for linking WhatsApp Web to an existing phone account. Validated against `web.whatsapp.com` (login screens 2026-11-14).

## Preferred method — link with phone number (no screen needed)

The whole flow completes on the user's phone: the agent drives the browser, the user only types a code on their own device. **Always prefer this over QR** — it works headless and is simpler even when a screen is available.

```bash
node .agents/skills/browser-automation/scripts/browser.js open "https://web.whatsapp.com/"
```

1. **Open WhatsApp Web** (headless is fine). The login screen shows two buttons: "Vincular con el número de teléfono" and "Iniciar sesión con número de teléfono" — both lead to the same flow.
2. **Click "Iniciar sesión con número de teléfono"** (`find text "número de teléfono" click`, or its `@eN` ref from `snapshot -i`).
3. **Select country + enter phone number.** The country button shows flag + dial code and opens a searchable listbox (type the country name to filter). The phone field is prefilled with the dial code — type the local number only.
4. **Click "Siguiente".**
5. **Read the 8-character code** the page now displays (`exec read` or `snapshot`) and **give it to the user**. On their phone they tap the "Ingresar código" notification, confirm the device (name/location shown), verify identity if prompted (biometric/PIN), and type the code.
6. **Done** — the browser loads the chat list. Session persists in `.browser-profile`; subsequent opens are headless.

### Notes

- The code **expires (~6 min)** — if it lapses, restart the flow for a fresh one.
- The primary phone must have WhatsApp and receive the notification. The phone shows the device name/location before confirming — the user should verify it's expected.
- This links a **companion device** — it cannot create a WhatsApp account, and the account must already exist on a phone.
- Max **4 linked devices**; the primary phone must connect every ~14 days or linked devices log out.
- Unrecognized devices may trigger an extra "link this device?" confirmation on the phone.

## Fallback — QR scan (requires seeing the screen)

Only if phone linking fails or the user prefers it. Useless for remote/headless users unless via `browser-share.js`.

```bash
node .agents/skills/browser-automation/scripts/browser.js open "https://web.whatsapp.com/" --headed
```

The user scans the QR with the phone camera (WhatsApp → Dispositivos vinculados → Vincular dispositivo).

## Selector notes

WhatsApp Web renders its UI with React and dynamic class names. Prefer semantic attributes and text:

| Element | How to locate |
|---|---|
| Phone-login button | `find text "número de teléfono" click` or `snapshot -i` ref |
| Country selector | `button` showing flag emoji + dial code (e.g. "🇦🇷 Argentina") |
| Phone input | `textbox` with aria-label "Ingresa tu número de teléfono..." |
| Next button | `button "Siguiente"` |
| Country list filter | `textbox` inside the opened `listbox` — type to filter |
| QR region | `div[data-testid="qr-code"]` (if available) or `canvas` near the text `Usa WhatsApp en tu computadora` |

## Verification

After linking, wait for the main chat list. A safe check is to look for the search box or the chat list header.

```bash
node .agents/skills/browser-automation/scripts/browser.js exec eval "(() => document.querySelector('[data-testid=\"chat-list\"]') !== null)()"
```

## Auth state persistence

The session persists automatically in the repo's `.browser-profile/` — after a successful link, subsequent `goto`/`open` calls can run headless and reuse the logged-in state. No explicit state export is needed.

## Anti-patterns

- **Do not** ask the user to share their WhatsApp account token or seed.
- **Do not** try to decode the QR code image and send it elsewhere; the QR is for the current browser session only.
- **Do not** export or copy session state outside `.browser-profile/` — it contains the live WhatsApp credentials.
- **Do not** default to QR when phone linking is available — it requires the user to see the screen.

**Validated:** 2026-11-14 against live `web.whatsapp.com` (login screens; full link not exercised — needs a real account).
