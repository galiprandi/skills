---
name: gmail
description: Automate Gmail with playwright-cli. Covers reading inbox via Atom feed, composing emails, searching, archiving, labeling, and keyboard shortcuts. Use when checking email, sending messages, managing inbox, or extracting email data. Requires browser-core skill for setup.
---

# Gmail Automation

Automate Gmail via `playwright-cli` using a mix of UI interactions, keyboard shortcuts, and the Gmail Atom feed for bulk inbox reading.

**Prerequisite:** Read the `browser-core` skill first for profile-dir setup and core commands.

## Setup

```bash
# Open Gmail (headless if already logged in, headed for login)
playwright-cli open "https://mail.google.com" --persistent --profile ./.browser-profile --headed

# If login needed: user logs in manually, then save state
playwright-cli state-save ./.browser-profile/auth-state.json
playwright-cli close

# Next sessions: load state and go headless
playwright-cli open "https://mail.google.com" --persistent --profile ./.browser-profile
playwright-cli state-load ./.browser-profile/auth-state.json
```

## Reading inbox

### Atom feed (PREFERRED for bulk inbox reading)

One HTTP call returns unread inbox emails with title, sender, email, and summary. No UI navigation needed.

```bash
playwright-cli eval "(async()=>{var r=await fetch('https://mail.google.com/mail/feed/atom');var t=await r.text();return t.substring(0,2000)})()"
```

Returns XML Atom feed containing:
- `<fullcount>` — number of unread emails
- `<entry>` per email with `<title>`, `<author><name>`, `<author><email>`, `<summary>`, `<modified>`

**Parse the feed:**
```bash
playwright-cli eval "(async()=>{
  var r=await fetch('https://mail.google.com/mail/feed/atom');
  var t=await r.text();
  var p=new DOMParser();
  var d=p.parseFromString(t,'text/xml');
  var entries=d.querySelectorAll('entry');
  var out=[];
  for(var i=0;i<entries.length;i++){
    var e=entries[i];
    out.push({
      title:e.querySelector('title').textContent,
      from:e.querySelector('author name').textContent,
      email:e.querySelector('author email').textContent,
      summary:e.querySelector('summary').textContent.substring(0,150),
      modified:e.querySelector('modified').textContent
    });
  }
  return JSON.stringify(out);
})()"
```

**Feed endpoints:**
- `https://mail.google.com/mail/feed/atom` — unread inbox
- `https://mail.google.com/mail/feed/atom/unread` — unread only
- `https://mail.google.com/mail/feed/atom/<label>` — emails with a specific label (e.g. `job-alerts`)

**Limitation:** The Atom feed only returns unread emails (max 20). For read emails or full content, use the UI.

### UI: navigate to inbox

```bash
playwright-cli goto "https://mail.google.com/mail/u/0/#inbox"
sleep 3
playwright-cli snapshot
```

### UI: open a specific email

```bash
# Navigate by URL (requires thread ID)
playwright-cli goto "https://mail.google.com/mail/u/0/#inbox/<threadId>"
sleep 3
playwright-cli snapshot
```

Or click an email row from the inbox list:
```bash
playwright-cli snapshot
# Find the email row ref, then click
playwright-cli click <row_ref>
sleep 2
playwright-cli snapshot
```

## Composing emails

### Open compose dialog

```bash
# Method 1: Click "Redactar" / "Compose" button
playwright-cli snapshot
playwright-cli click <compose_button_ref>

# Method 2: Keyboard shortcut 'c' opens compose
playwright-cli press c
sleep 2
playwright-cli snapshot
```

### Fill compose fields

The compose dialog has these fields. **Refs change after every action — snapshot before each interaction.**

```bash
playwright-cli snapshot

# Subject (standard input, fill works)
playwright-cli fill <subject_ref> "Your subject"

# Body (contenteditable, fill works)
playwright-cli fill <body_ref> "Email body text"

# Recipient ("Para" / "To") — custom component
# The "To" field collapses when not focused. Click the "Destinatarios" label to expand it:
playwright-cli snapshot
playwright-cli click <destinatarios_label_ref>
sleep 1
# Then fill via eval (the input appears dynamically):
playwright-cli eval "(function(){
  var el = document.querySelector('input[aria-label=Destinatarios], input[aria-label=To]');
  if(!el) return 'not found';
  el.value = 'recipient@example.com';
  el.dispatchEvent(new Event('input',{bubbles:true}));
  return el.value;
})()"
```

**Important:** The "To" field aria-label depends on Gmail's language setting:
- Spanish: `aria-label="Destinatarios"`
- English: `aria-label="To"`

### Send email

```bash
playwright-cli snapshot
# Find "Enviar" / "Send" button ref
playwright-cli click <send_ref>
```

Or use keyboard shortcut:
```bash
playwright-cli press "Control+Enter"   # Windows/Linux
playwright-cli press "Meta+Enter"      # Mac
```

### Compose field reference

| Field | Element type | How to fill | aria-label (ES/EN) |
|---|---|---|---|
| To (recipient) | input (dynamic) | eval (custom component) | Destinatarios / To |
| Cc | input (dynamic) | eval | CC / Cc |
| Bcc | input (dynamic) | eval | CCO / Bcc |
| Subject | input | `fill <ref>` | Asunto / Subject |
| Body | div[contenteditable] | `fill <ref>` | Cuerpo del mensaje / Message Body |

**Cc/Bcc fields are hidden by default.** Click the "Cc/Bcc" labels in the compose dialog to reveal them.

## Search

### Search bar

```bash
playwright-cli snapshot
playwright-cli fill <search_ref> "from:linkedin.com subject:job"
playwright-cli press Enter
sleep 3
playwright-cli snapshot
```

### Search operators (work in the search bar)

| Operator | Example | What it does |
|---|---|---|
| `from:` | `from:recruiter@company.com` | Emails from sender |
| `to:` | `to:candidate@gmail.com` | Emails to recipient |
| `subject:` | `subject:interview` | Subject contains text |
| `has:attachment` | `from:hr has:attachment` | Emails with attachments |
| `label:` | `label:job-alerts` | Emails with label |
| `is:unread` | `is:unread from:linkedin` | Unread emails |
| `is:starred` | `is:starred` | Starred emails |
| `after:` / `before:` | `after:2026/01/01 before:2026/08/01` | Date range |
| `older_than:` | `older_than:7d` | Older than N days (d/m/y) |
| `newer_than:` | `newer_than:1d` | Newer than N days |
| `filename:` | `filename:pdf` | Attachments of type |
| `OR` | `from:a.com OR from:b.com` | Boolean OR |
| `-` | `from:linkedin -subject:promotion` | Exclude |

### Navigate to label/folder by URL

```bash
playwright-cli goto "https://mail.google.com/mail/u/0/#label/job-alerts"
playwright-cli goto "https://mail.google.com/mail/u/0/#starred"
playwright-cli goto "https://mail.google.com/mail/u/0/#sent"
playwright-cli goto "https://mail.google.com/mail/u/0/#drafts"
playwright-cli goto "https://mail.google.com/mail/u/0/#all"
```

## Keyboard shortcuts

Gmail has extensive keyboard shortcuts. They work with `playwright-cli press <key>`.

**Must enable:** Settings → See all settings → General → Keyboard shortcuts: ON

### Navigation

| Shortcut | Action |
|---|---|
| `g` then `i` | Go to Inbox |
| `g` then `s` | Go to Starred |
| `g` then `t` | Go to Sent |
| `g` then `d` | Go to Drafts |
| `g` then `a` | Go to All Mail |
| `g` then `l` | Go to Label (opens label picker) |

### Email actions

| Shortcut | Action |
|---|---|
| `c` | Compose new email |
| `x` | Select email (checkbox) |
| `e` | Archive selected email |
| `#` | Delete selected email |
| `s` | Star/unstar email |
| `l` | Apply label (opens label menu) |
| `v` | Move to label (opens label menu) |
| `r` | Reply to email |
| `a` | Reply all |
| `f` | Forward email |
| `m` | Mute thread |
| `Shift+I` | Mark as read |
| `Shift+U` | Mark as unread |

### Thread navigation

| Shortcut | Action |
|---|---|
| `j` | Next email (older) |
| `k` | Previous email (newer) |
| `Enter` | Open email |
| `u` | Back to inbox from email view |

### Usage with playwright-cli

```bash
# Select first email, then archive it
playwright-cli press x
sleep 1
playwright-cli press e

# Go to sent mail
playwright-cli press g
sleep 0.5
playwright-cli press t
```

**Note:** Two-key shortcuts (like `g` then `i`) require a small delay between keys.

## Archive / delete / label

### Archive (UI)

```bash
# Select email first
playwright-cli press x
sleep 1
playwright-cli snapshot
# Find "Archivar" / "Archive" button ref
playwright-cli click <archive_ref>
```

Or keyboard shortcut:
```bash
playwright-cli press x
sleep 1
playwright-cli press e
```

### Apply label

```bash
playwright-cli press x
sleep 1
playwright-cli press l
sleep 2
playwright-cli snapshot
# Find label in menu, click it
playwright-cli click <label_ref>
```

### Delete

```bash
playwright-cli press x
sleep 1
playwright-cli press "#"
```

## Tips

### Gmail loads slowly — always wait

Gmail is a heavy SPA. After `goto` or any navigation:
```bash
playwright-cli goto "https://mail.google.com/mail/u/0/#inbox"
sleep 3                    # wait for JS to render
playwright-cli snapshot    # then capture
```

### The compose "To" field is tricky

The "To" field is a custom component that:
1. Collapses when not focused (shows "Destinatarios" label instead of input)
2. Has language-dependent aria-label
3. Doesn't appear in snapshots as a textbox until expanded

**Reliable approach:** click the label to expand, then use `eval` to fill:
```bash
playwright-cli snapshot
playwright-cli click <destinatarios_label_ref>
sleep 1
playwright-cli eval "(function(){var el=document.querySelector('input[aria-label=Destinatarios],input[aria-label=To]');if(!el)return 'not found';el.value='recipient@example.com';el.dispatchEvent(new Event('input',{bubbles:true}));return el.value})()"
```

### Use Atom feed for quick inbox checks

Don't navigate the UI just to check if there are new emails. Use the feed:
```bash
playwright-cli eval "(async()=>{var r=await fetch('https://mail.google.com/mail/feed/atom');var t=await r.text();var m=t.match(/<fullcount>(\d+)<\/fullcount>/);return m?m[1]+' unread':'error'})()"
```

### Multiple Gmail accounts

Gmail supports multiple accounts in the same browser. The URL pattern includes the account index:
- `mail.google.com/mail/u/0/` — first account
- `mail.google.com/mail/u/1/` — second account

## Anti-patterns

- **Don't** navigate the UI just to check unread count — use the Atom feed
- **Don't** try to fill the "To" field without expanding it first
- **Don't** reuse refs after clicking or pressing keys — take a new snapshot
- **Don't** forget to wait 3s after `goto` — Gmail is a heavy SPA
- **Don't** try to log in programmatically — open headed and let the user log in
- **Don't** use `type` for multiline body text — use `fill <ref>` instead
