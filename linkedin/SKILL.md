---
name: linkedin
description: Automate LinkedIn with playwright-cli. Covers messaging (send text + attachments via Voyager endpoints), bulk inbox fetch, profile navigation, job search, and Easy Apply. Use when sending LinkedIn messages, reading inbox, applying to jobs, or extracting profile data. Requires browser-core skill for setup.
---

# LinkedIn Automation

Automate LinkedIn via `playwright-cli` using a mix of UI interactions and internal Voyager API endpoints. The API endpoints run inside `page.evaluate()` so they inherit the browser's cookies automatically.

**Prerequisite:** Read the `browser-core` skill first for profile-dir setup and core commands.

## Setup

```bash
# Open LinkedIn (headless if already logged in, headed for login)
playwright-cli open "https://www.linkedin.com" --persistent --profile ./.browser-profile --headed

# If login needed: user logs in manually, then save state
playwright-cli state-save ./.browser-profile/auth-state.json
playwright-cli close

# Next sessions: load state and go headless
playwright-cli open "https://www.linkedin.com" --persistent --profile ./.browser-profile
playwright-cli state-load ./.browser-profile/auth-state.json
```

## Messaging

### Bulk inbox fetch (PREFERRED over UI scraping)

One HTTP call returns ALL conversations with participants, unread count, last message, and timestamp. Avoids opening conversations one by one.

```bash
# Navigate to messaging first (loads required cookies)
playwright-cli goto "https://www.linkedin.com/messaging/"
sleep 3

# Fetch all conversations via Voyager GraphQL
playwright-cli eval "(function(){
  var csrf = document.cookie.split('; ').find(function(c){return c.indexOf('JSESSIONID=')===0});
  csrf = csrf ? csrf.split('=')[1].replace(/\"/g,'') : '';

  // Extract self profile ID from page HTML
  var selfId = (document.documentElement.outerHTML.match(/ACoAA[A-Za-z0-9_-]{5,}/g)||[]).sort(function(a,b){
    return document.documentElement.outerHTML.split(a).length - document.documentElement.outerHTML.split(b).length;
  }).pop();

  var queryId = 'messengerConversations.0d5e6781bbee71c3e51c8843c6519f48';
  var mailbox = 'urn%3Ali%3Afsd_profile%3A' + selfId;

  return fetch('/voyager/api/voyagerMessagingGraphQL/graphql?queryId=' + queryId + '&variables=(mailboxUrn:' + mailbox + ')', {
    headers: {
      'accept': 'application/vnd.linkedin.normalized+json+2.1',
      'x-restli-protocol-version': '2.0.0',
      'x-li-lang': 'en_US',
      'csrf-token': csrf
    }
  }).then(function(r){return r.text()}).then(function(t){return t.substring(0,3000)});
})()"
```

**Query ID changes over time.** If the endpoint returns HTML instead of JSON, find the current query ID:

```bash
playwright-cli eval "(function(){
  var entries = performance.getEntriesByType('resource');
  var conv = entries.filter(function(e){return e.name.indexOf('messengerConversations')>-1});
  return conv.map(function(e){return e.name.match(/queryId=(messengerConversations\.[a-f0-9]+)/)||[]}).map(function(m){return m[1]}).filter(Boolean);
})()"
```

**Decision logic after fetch:**
- `unreadCount > 0` → open that thread to read and respond
- `lastMessage.isFromSelf === true` → waiting for reply, no action needed
- `lastActivityAt` → compare against your last review timestamp to detect new activity

### Send text-only message (new conversation)

```bash
playwright-cli eval "(function(){
  var csrf = document.cookie.split('; ').find(function(c){return c.indexOf('JSESSIONID=')===0});
  csrf = csrf ? csrf.split('=')[1].replace(/\"/g,'') : '';

  var RECIPIENT_ID = '<fsd_profile_id>';
  var MESSAGE_TEXT = 'your message';

  var body = {
    keyVersion: 'LEGACY_INBOX',
    conversationCreate: {
      eventCreate: {
        value: {
          'com.linkedin.voyager.messaging.create.MessageCreate': {
            attributedBody: {text: MESSAGE_TEXT, attributes: []},
            attachments: []
          }
        }
      },
      recipients: [RECIPIENT_ID],
      subtype: 'MEMBER_TO_MEMBER'
    }
  };

  return fetch('/voyager/api/messaging/conversations?action=create', {
    method: 'POST',
    headers: {
      'accept': 'application/vnd.linkedin.normalized+json+2.1',
      'x-restli-protocol-version': '2.0.0',
      'x-li-lang': 'en_US',
      'csrf-token': csrf,
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  }).then(function(r){return r.text()}).then(function(t){return t.substring(0,1500)});
})()"
```

Returns `conversationUrn` containing the thread ID (`2-XXXXX==`) for future replies.

### Send text-only reply (existing conversation)

```bash
playwright-cli eval "(function(){
  var csrf = document.cookie.split('; ').find(function(c){return c.indexOf('JSESSIONID=')===0});
  csrf = csrf ? csrf.split('=')[1].replace(/\"/g,'') : '';

  var THREAD_ID = '2-XXXXX==';  // from conversationUrn
  var MESSAGE_TEXT = 'your reply';

  var body = {
    eventCreate: {
      value: {
        'com.linkedin.voyager.messaging.create.MessageCreate': {
          attributedBody: {text: MESSAGE_TEXT, attributes: []},
          attachments: []
        }
      }
    }
  };

  return fetch('/voyager/api/messaging/conversations/' + encodeURIComponent(THREAD_ID) + '/events?action=create', {
    method: 'POST',
    headers: {
      'accept': 'application/vnd.linkedin.normalized+json+2.1',
      'x-restli-protocol-version': '2.0.0',
      'x-li-lang': 'en_US',
      'csrf-token': csrf,
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  }).then(function(r){return r.text()}).then(function(t){return t.substring(0,1500)});
})()"
```

### Send message with attachment (dash endpoint)

This is the only way to send attachments via endpoint. The attachment goes in `renderContentUnions`, NOT in `attachments` (which is silently dropped).

```bash
# Step 1: Register upload + upload binary + send message (all in one eval)
playwright-cli eval "(function(){
  var csrf = document.cookie.split('; ').find(function(c){return c.indexOf('JSESSIONID=')===0});
  csrf = csrf ? csrf.split('=')[1].replace(/\"/g,'') : '';

  var selfId = (document.documentElement.outerHTML.match(/ACoAA[A-Za-z0-9_-]{5,}/g)||[]).sort(function(a,b){
    return document.documentElement.outerHTML.split(a).length - document.documentElement.outerHTML.split(b).length;
  }).pop();

  var THREAD_ID = '2-XXXXX==';
  var MESSAGE_TEXT = 'message with attachment';
  var CONV_URN = 'urn:li:msg_conversation:(urn:li:fsd_profile:' + selfId + ',' + THREAD_ID + ')';

  // File content as base64 (encode before passing to eval)
  var FILE_B64 = '<base64_encoded_file>';
  var FILE_NAME = 'document.pdf';
  var FILE_MIME = 'application/pdf';

  function uuid(){return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0;var v=c==='x'?r:(r&0x3|0x8);return v.toString(16)})}
  function b64ToBlob(b64,mime){var bin=atob(b64);var arr=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);return new Blob([arr],{type:mime})}

  var trackingId='';for(var i=0;i<16;i++)trackingId+=String.fromCharCode(Math.floor(Math.random()*256));
  var fileBlob=b64ToBlob(FILE_B64,FILE_MIME);
  var fileSize=fileBlob.size;

  // Register upload
  return fetch('/voyager/api/voyagerVideoDashMediaUploadMetadata?action=upload',{
    method:'POST',
    headers:{'accept':'application/vnd.linkedin.normalized+json+2.1','x-restli-protocol-version':'2.0.0','x-li-lang':'en_US','csrf-token':csrf,'content-type':'application/json'},
    body:JSON.stringify({mediaUploadType:'MESSAGING_FILE_ATTACHMENT',fileSize:fileSize,filename:FILE_NAME})
  }).then(function(r){return r.json()}).then(function(reg){
    var uploadUrl=reg.data.value.singleUploadUrl;
    var mediaUrn=reg.data.value.urn;
    // Upload binary
    return fetch(uploadUrl,{method:'PUT',headers:{'content-type':FILE_MIME},body:fileBlob}).then(function(){
      return new Promise(function(res){setTimeout(function(){res({mediaUrn:mediaUrn})},2000)});
    });
  }).then(function(data){
    var blobUrl=URL.createObjectURL(fileBlob);
    var body=JSON.stringify({
      message:{
        body:{attributes:[],text:MESSAGE_TEXT},
        renderContentUnions:[{file:{assetUrn:data.mediaUrn,byteSize:fileSize,mediaType:FILE_MIME,name:FILE_NAME,url:blobUrl}}],
        conversationUrn:CONV_URN,
        originToken:uuid()
      },
      mailboxUrn:'urn:li:fsd_profile:'+selfId,
      trackingId:trackingId,
      dedupeByClientGeneratedToken:false
    });
    return fetch('/voyager/api/voyagerMessagingDashMessengerMessages?action=createMessage',{
      method:'POST',
      headers:{'accept':'application/json','x-restli-protocol-version':'2.0.0','x-li-lang':'en_US','csrf-token':csrf,'content-type':'text/plain;charset=UTF-8'},
      body:body
    }).then(function(r){return r.text()}).then(function(t){return t.substring(0,1500)});
  });
})()"
```

**Key details for attachments:**
- `content-type: text/plain;charset=UTF-8` (NOT `application/json`)
- `trackingId`: 16 random binary bytes as string (NOT a UUID string)
- `originToken`: standard UUID v4
- `url`: a `blob:` URL from `URL.createObjectURL()` (required even though it's client-side)
- `conversationUrn` format: `urn:li:msg_conversation:(urn:li:fsd_profile:<self_id>,<thread_id>)`
- The asset does NOT need to be `AVAILABLE` before sending — the dash endpoint accepts it immediately after upload

### Attach file via UI (fallback)

If the endpoint flow fails (LinkedIn changes schema), use the UI:

```bash
# Navigate to the conversation thread
playwright-cli goto "https://www.linkedin.com/messaging/thread/2-XXXXX==/"
sleep 3
playwright-cli snapshot

# Find "Attach a file" button ref, click it
playwright-cli click <attach_ref>

# Upload file (file chooser opens automatically)
playwright-cli upload /path/to/file.pdf
sleep 3

# Fill message and send
playwright-cli snapshot
playwright-cli fill <textbox_ref> "your message"
playwright-cli snapshot
playwright-cli click <send_ref>
```

**Attach buttons only appear when a conversation is open** (not in the messaging list view).

## Profile navigation

### Find someone's profile ID

```bash
playwright-cli goto "https://www.linkedin.com/in/<username>/"
sleep 3
playwright-cli eval "(function(){
  var ids = document.documentElement.outerHTML.match(/ACoAA[A-Za-z0-9_-]{5,}/g) || [];
  // Most frequent ID is usually the profile owner (not self)
  var counts = {};
  ids.forEach(function(id){counts[id] = (counts[id]||0) + 1});
  return Object.entries(counts).sort(function(a,b){return b[1]-a[1]})[0][0];
})()"
```

### Navigate to a conversation by thread ID

```bash
playwright-cli goto "https://www.linkedin.com/messaging/thread/2-XXXXX==/"
sleep 3
playwright-cli snapshot
```

## Tiptap editor (compose message in UI)

LinkedIn uses a tiptap (ProseMirror) contenteditable editor for messages.

- **`fill <ref> "text"` works** for writing into tiptap. This is the reliable method.
- **`type "text"` without a ref does NOT work** — tiptap's contenteditable doesn't receive it.
- **`type` with multiline text fails** — CLI parses newlines as multiple arguments.
- **Snapshot does NOT show typed text inline** — tiptap paragraphs appear empty. Verify with:
  ```bash
  playwright-cli eval "() => document.querySelector('[contenteditable=true]')?.innerText?.substring(0,300)"
  ```

## Key headers for Voyager API

All Voyager API calls from `eval` need these headers:

```
accept: application/vnd.linkedin.normalized+json+2.1
x-restli-protocol-version: 2.0.0
x-li-lang: en_US
csrf-token: <JSESSIONID cookie value, without quotes>
```

CSRF token extraction:
```js
var csrf = document.cookie.split('; ').find(function(c){return c.indexOf('JSESSIONID=')===0});
csrf = csrf ? csrf.split('=')[1].replace(/"/g,'') : '';
```

## Anti-patterns

- **Don't** open conversations one by one when you can use the bulk inbox fetch
- **Don't** put attachments in `attachments[]` field — use `renderContentUnions`
- **Don't** use `content-type: application/json` for the dash endpoint — use `text/plain`
- **Don't** reuse refs after navigating or clicking — take a new snapshot
- **Don't** try to log in programmatically — open headed and let the user log in
- **Don't** send messages without user approval if they're real outreach

## API reference

See [references/voyager-api.md](references/voyager-api.md) for detailed endpoint documentation.
