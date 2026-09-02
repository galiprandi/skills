---
name: teams
description: Automate Microsoft Teams via internal chatsvc API for messaging, navigation, and chat management.
verified: 2026-09-02
---

# Microsoft Teams Automation

Automate Microsoft Teams via internal chatsvc API. Token is extracted from browser localStorage, then used to send/delete messages via REST. No UI interaction needed for messaging.

## Keyboard shortcuts

**Always prefer keyboard shortcuts over clicking buttons.** They are faster, more reliable, and don't depend on generated CSS classes or DOM structure that changes between updates.

**Show shortcuts panel:** `Ctrl+.` (period) — opens the keyboard shortcuts dialog in Teams Web. Use this to verify shortcuts are enabled and discover new ones.

**Focus matters:** Some shortcuts (like `Alt+N`, `Ctrl+G`, `Alt+R`) require focus to be in the main Teams area, not in a search box or dialog. If a shortcut doesn't work, press `Esc` first to reset focus, then retry.

**Verification:** After navigation shortcuts, check `document.title` — it changes to include the app name (e.g. "Chat", "Calendar", "Llamadas", "Actividad"). Wait 2-3 seconds for the SPA to render.

### Core shortcuts (most useful for automation)

| Shortcut | Action |
|---|---|
| `Ctrl+.` | Show keyboard shortcuts |
| `Ctrl+Shift+F` | Open filter |
| `Ctrl+F` | Find in current chat or channel |
| `Ctrl+Enter` | Send (expanded compose) |
| `Shift+Enter` | Start new line |
| `Esc` | Close |

### Navigate apps

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+1` | Activity |
| `Ctrl+Shift+2` | Chat |
| `Ctrl+Shift+3` | Calendar |
| `Ctrl+Shift+4` | Calls |
| `Ctrl+Shift+5` | OneDrive |
| `Ctrl+Shift+6` | Copilot |
| `Ctrl+Shift+7` | Communicator |

### Navigate chat tabs

`Alt+1` through `Alt+9` — open 1st-9th tab on chat header.

### Other shortcuts (compact reference)

- `Ctrl+Alt+E` — Go to Search
- `Alt+N` — Start a new chat
- `Ctrl+Shift+,` — Open Settings
- `Ctrl+F1` — Open Help
- `Ctrl+Alt+Shift+R` — Report a problem
- `Ctrl+G` — Go to a specific chat or channel
- `Ctrl+Alt+Enter` — Move focus to pane divider
- `Ctrl+Shift+Enter` — Return pane to default width
- `Alt+Shift+L` — Move focus to chat/channel list
- `Alt+Shift+M` — Move focus to message pane
- `Alt+Shift+R` — Go to compose box
- `Ctrl+F6` / `Ctrl+Shift+F6` — Go to next / previous section
- `Alt+Q` — Collapse all conversational folders
- `Shift+Esc` — Mark all as read
- `Alt+J` — Jump to last read or newest message
- `Alt+P` — Toggle details pane
- `Alt+R` — Reply to last message
- `Ctrl+Alt+R` — React to last message
- `Ctrl+Alt+U` — See all unread chats
- `Ctrl+Alt+C` / `Ctrl+Alt+A` / `Ctrl+Alt+B` — See all chat / channel / meeting conversations
- `Ctrl+Alt+Z` — Clear all filters
- `Ctrl+Shift+X` — Expand compose box
- `Ctrl+B` / `Ctrl+I` / `Ctrl+U` — Bold / Italic / Underline
- `Ctrl+Alt+X` — Strikethrough
- `Ctrl+Shift+I` — Mark message as important
- `Ctrl+K` — Insert link
- `Alt+Shift+O` — Attach file
- `Ctrl+Alt+1` / `Ctrl+Alt+2` / `Ctrl+Alt+3` — Heading 1 / 2 / 3
- `Ctrl+Alt+4` — Block quote
- `Ctrl+Alt+5` — Insert code
- `Ctrl+Alt+Shift+C` — Inline code
- `Ctrl+Alt+Shift+B` — Code block
- `Ctrl+Alt+L` — Add Loop paragraph
- `Alt+A` — Rewrite with Copilot
- `Alt+Shift+E` — Open video recorder
- `Alt+Shift+A` / `Alt+Shift+S` — Accept video / audio call
- `Ctrl+Shift+D` — Decline call
- `Alt+Shift+V` — Start video call
- `Ctrl+Shift+H` — End call
- `Ctrl+Shift+M` — Toggle mute
- `Ctrl+Shift+U` — Toggle speaker
- `Ctrl+Spacebar` — Temporarily unmute
- `Ctrl+Shift+K` — Raise/lower hand
- `Ctrl+Shift+E` — Toggle share content tray
- `Alt+N` — Schedule a meeting
- `Alt+Shift+J` — Join from meeting details
- `Ctrl+S` — Save/send meeting request
- `Enter` — Open selected item (calendar)
- `Alt+Shift+1` to `Alt+Shift+5` — Day / Work week / Week / Month / Agenda views
- `Ctrl+Alt+Left` / `Ctrl+Alt+Right` — Previous / next time period
- `Alt+Down` / `Alt+Up` — Next / previous week
- `Alt+PageDown` / `Alt+PageUp` — Next / previous month
- `Alt+F1` — Open/collapse left pane
- `Shift+Alt+Y` — Go to today
- `Ctrl+P` — Print calendar
- `Ctrl+Enter` — Send meeting
- `Ctrl+Z` — Undo
- `Ctrl+Shift+Q` — Create meeting request
- `Ctrl+Alt+K` — Mark all as read (activity)
- `Ctrl+Alt+M` — Filter to @ mentions

### Usage with playwright-cli

```bash
# Show keyboard shortcuts panel
node .agents/skills/browser-automation/scripts/browser.js exec press Control+.

# Go to Chat
node .agents/skills/browser-automation/scripts/browser.js exec press Control+Shift+2

# Go to Calendar
node .agents/skills/browser-automation/scripts/browser.js exec press Control+Shift+3

# Start a new chat
node .agents/skills/browser-automation/scripts/browser.js exec press Alt+n

# Go to a specific chat or channel
node .agents/skills/browser-automation/scripts/browser.js exec press Control+g

# Mark all as read
node .agents/skills/browser-automation/scripts/browser.js exec press Shift+Escape

# Reply to last message
node .agents/skills/browser-automation/scripts/browser.js exec press Alt+r

# Send message (in expanded compose)
node .agents/skills/browser-automation/scripts/browser.js exec press Control+Enter
```

## Setup

```bash
# Open Teams (headed for login, headless after)
node .agents/skills/browser-automation/scripts/browser.js open "https://teams.microsoft.com" --headed

# If login needed: user logs in manually, then save state
node .agents/skills/browser-automation/scripts/browser.js save-state
node .agents/skills/browser-automation/scripts/browser.js close

# Next sessions: load state and go headless
node .agents/skills/browser-automation/scripts/browser.js open "https://teams.microsoft.com"
node .agents/skills/browser-automation/scripts/browser.js load-state
```

## Token extraction (from browser localStorage)

Teams stores auth tokens in localStorage. Extract them via `eval`:

```bash
# Navigate to Teams first (ensures localStorage is populated)
node .agents/skills/browser-automation/scripts/browser.js goto "https://teams.microsoft.com"

# Extract token from ic3.teams.office.com key
node .agents/skills/browser-automation/scripts/browser.js exec eval "(function(){
  const keys = Object.keys(localStorage);
  const k = keys.find(k => k.includes('ic3.teams.office.com') && k.includes('accesstoken'));
  if (!k) return JSON.stringify({error: 'no ic3 token found'});
  const v = JSON.parse(localStorage.getItem(k));
  return JSON.stringify({token: v.secret || v.accessToken, expiresOn: v.expiresOn || v.expires_on});
})()"
```

**Token details:**
- Expires in ~1 hour
- JWT payload contains `oid` (user ID) and `displayName` (user name)
- Parse JWT: `JSON.parse(atob(token.split('.')[1]))`

**Token fallback (if ic3 token fails with 401):**

The `ic3.teams.office.com` token may not work for the chatsvc API. Alternative source:

```bash
node .agents/skills/browser-automation/scripts/browser.js exec eval "(function(){
  const keys = Object.keys(localStorage);
  const k = keys.find(k => k.includes('chatsvcagg.teams.microsoft.com') && k.includes('accesstoken'));
  if (!k) return JSON.stringify({error: 'no chatsvcagg token found'});
  const v = JSON.parse(localStorage.getItem(k));
  return JSON.stringify({token: v.secret || v.accessToken});
})()"
```

The `oid` from the chatsvcagg token may be different from the ic3 token. Use the one that matches the token you're using.

## Send message via chatsvc API

```bash
node .agents/skills/browser-automation/scripts/browser.js exec eval "(async function(){
  // 1. Extract token
  const keys = Object.keys(localStorage);
  const tk = keys.find(k => k.includes('ic3.teams.office.com') && k.includes('accesstoken'));
  if (!tk) return 'no_token';
  const tv = JSON.parse(localStorage.getItem(tk));
  const token = tv.secret || tv.accessToken;

  // 2. Parse JWT for oid and displayName
  const payload = JSON.parse(atob(token.split('.')[1]));
  const oid = payload.oid;
  const name = payload.displayName || payload.name || '';

  // 3. URL-encode chatId (19:meeting_xxx@thread.v2 -> 19%3Ameeting_xxx%40thread.v2)
  const chatId = '19:meeting_xxx@thread.v2';
  const chatIdEnc = chatId.replace(/:/g, '%3A').replace(/@/g, '%40');

  // 4. Build message body
  const body = {
    id: -1,
    type: 'Message',
    conversationid: chatId,
    from: '8:orgid:' + oid,
    contenttype: 'Text',
    messagetype: 'RichText/Html',
    content: '<p>Your message here</p>',
    imdisplayname: name,
    clientmessageid: Math.floor(Math.random() * 1e9),
    composetime: new Date().toISOString(),
    originalarrivaltime: new Date().toISOString(),
    properties: {},
    formatVariant: 'TEAMS'
  };

  // 5. Send
  const r = await fetch('https://teams.microsoft.com/api/chatsvc/amer/v1/users/ME/conversations/' + chatIdEnc + '/messages', {
    method: 'POST',
    headers: {
      'authorization': 'Bearer ' + token,
      'content-type': 'application/json',
      'behavioroverride': 'redirectAs404',
      'x-ms-migration': 'True'
    },
    body: JSON.stringify(body)
  });
  return r.status + ' ' + r.statusText;
})()"
```

**HTTP 201 = success.** The response contains the `messageId` needed for deletion.

## Delete message (soft delete)

```bash
node .agents/skills/browser-automation/scripts/browser.js exec eval "(async function(){
  // Extract token (same as send)
  const keys = Object.keys(localStorage);
  const tk = keys.find(k => k.includes('ic3.teams.office.com') && k.includes('accesstoken'));
  const token = JSON.parse(localStorage.getItem(tk)).secret;

  const chatId = '19:meeting_xxx@thread.v2';
  const messageId = '1234567890';
  const chatIdEnc = chatId.replace(/:/g, '%3A').replace(/@/g, '%40');

  const r = await fetch('https://teams.microsoft.com/api/chatsvc/amer/v1/users/ME/conversations/' + chatIdEnc + '/messages/' + messageId + '?behavior=softDelete', {
    method: 'DELETE',
    headers: {
      'authorization': 'Bearer ' + token,
      'behavioroverride': 'redirectAs404',
      'x-ms-migration': 'True'
    }
  });
  return r.status + ' ' + r.statusText;
})()"
```

**HTTP 200 = success.** The message shows as "This message has been deleted" in the chat. Only soft-delete is available via API.

## chatId formats

| Chat type | Format | Example |
|---|---|---|
| Meeting chat | `19:meeting_xxx@thread.v2` | `19:meeting_NDQ2Nz...@thread.v2` |
| 1:1 chat | `19:*@unq.gbl.spaces` | `19:8:orgid:xxx@unq.gbl.spaces` |
| Group chat | `19:*@thread.v2` | `19:xxx_yyy@thread.v2` |

**Finding the chatId:** look in the DOM for elements with `id` containing `19:`. Alternatively, capture it from DevTools Network when sending a test message.

## API request capture (reverse engineering)

If the API changes and you need to rediscover endpoints, capture network requests:

```javascript
// capture-teams.js pattern — intercept POST requests
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launchPersistentContext('.browser-profile', {
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const page = await browser.newPage();
  page.on('request', (req) => {
    if (req.method() === 'POST' && (req.url().includes('chat') || req.url().includes('message'))) {
      console.log('URL:', req.url());
      console.log('Headers:', JSON.stringify(req.headers(), null, 2));
      console.log('Body:', req.postData());
    }
  });
  await page.goto('https://teams.microsoft.com', { waitUntil: 'networkidle' });
  // User sends a test message in the UI, script captures the request
})();
```

This pattern works for any web app, not just Teams. Use it to reverse-engineer undocumented APIs.

## Navigating chats (UI)

### Open a specific chat by name

The chat list uses `[role="treeitem"]`. "Chats" section may be collapsed — click to expand first.

```bash
# 1. Go to Chat app
node .agents/skills/browser-automation/scripts/browser.js exec press Control+Shift+2

# 2. Wait for chat list to load
node .agents/skills/browser-automation/scripts/browser.js exec eval "(async function(){
  for (let i = 0; i < 30; i++) {
    if (document.querySelectorAll('[role=\"treeitem\"]').length > 3) return 'ready';
    await new Promise(r => setTimeout(r, 500));
  }
  return 'timeout';
})()"

# 3. Expand "Chats" if collapsed
node .agents/skills/browser-automation/scripts/browser.js exec eval "(function(){
  const chats = Array.from(document.querySelectorAll('[role=\"treeitem\"]')).find(i =>
    i.offsetParent !== null && i.textContent.trim().startsWith('Chats')
  );
  if (chats) { chats.click(); return 'expanded'; }
  return 'not_found';
})()"

# 4. Click the chat by name
node .agents/skills/browser-automation/scripts/browser.js exec eval "(function(){
  const chat = Array.from(document.querySelectorAll('[role=\"treeitem\"]')).find(i =>
    i.offsetParent !== null && i.textContent.includes('Sprint review')
  );
  if (chat) { chat.click(); return 'clicked'; }
  return 'not_found';
})()"
```

### Read chat messages

```bash
# Get the message list text
node .agents/skills/browser-automation/scripts/browser.js exec eval "(async function(){
  await new Promise(r => setTimeout(r, 2000));
  const text = document.body.innerText;
  const idx = text.indexOf('Lista de mensajes');
  if (idx !== -1) return text.substring(idx, idx + 4000);
  // Fallback: look for message region
  const region = document.querySelector('[role=\"main\"], [aria-label*=\"mensaje\"]');
  if (region) return region.innerText.substring(0, 4000);
  return 'no messages found';
})()"
```

### Open chat tabs (files, notes, etc.)

Use `Alt+1` through `Alt+9` to open tabs on the chat header.

## UI fallback (for short messages without special chars)

If the API fails (token expired, endpoint changed), send via UI:

```bash
# 1. Navigate to the chat
node .agents/skills/browser-automation/scripts/browser.js goto "https://teams.microsoft.com/v2/chat/<chatId>"

# 2. Focus the textbox
node .agents/skills/browser-automation/scripts/browser.js exec eval "document.querySelector('div[role=textbox]').focus()"

# 3. Type the message (short, no accents, no newlines)
node .agents/skills/browser-automation/scripts/browser.js exec type "your message"

# 4. Press Enter to send
node .agents/skills/browser-automation/scripts/browser.js exec press Enter
```

## Gotchas (validated empirically)

- **Don't use `keyboard.type` with newlines** — Enter sends the message. Use `\n` in the message body via API instead.
- **Don't use `execCommand insertText`** — Teams uses Trusted Types policy, blocks it.
- **Don't use paste-text from clipboard** — pastes the previous clipboard content, not what you want.
- **Don't use m365 CLI** — requires Azure AD appId that you likely don't have.
- **Token expires in ~1 hour** — re-extract if you get 401.
- **ic3 token may not work for chatsvc** — use chatsvcagg token as fallback.
- **1:1 chats use `@unq.gbl.spaces` format**, not `@thread.v2`.
- **chatsvc endpoint may vary** — `https://teams.microsoft.com/api/chatsvc/amer/v1` or `https://chatsvcagg.teams.microsoft.com`.
- **`keyboard.type` doesn't support accents or special characters** in Teams — use the API for those.
- **Status must be lowercase** in API calls (if applicable to your endpoint).

## Anti-patterns

- **Don't** hardcode tokens — extract from localStorage at runtime
- **Don't** use UI for messages with newlines or special characters — use the API
- **Don't** hard-delete — only softDelete is available via API
