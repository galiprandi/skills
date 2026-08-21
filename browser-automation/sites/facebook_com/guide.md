---
name: facebook
description: Automate Facebook groups for post scraping, member directory extraction, and content monitoring.
---

# Facebook Groups Automation Guide

> **Prerequisite:** Read the parent [SKILL.md](../../SKILL.md) for golden rules, wrapper usage, and session management.

## Setup

### Open Facebook

```bash
node scripts/browser.js goto "https://www.facebook.com/"
```

Wait 5-8 seconds for the feed to load. Facebook is a SPA that hydrates progressively.

### Login

Facebook requires manual login (email + password + possible 2FA). If the session is expired, open in headed mode:

```bash
node scripts/browser.js open "https://www.facebook.com/" --headed
```

The session persists in `.browser-profile`. Do NOT attempt to log in programmatically with user credentials.

## Core flows

### Open a group

```bash
node scripts/browser.js goto "https://www.facebook.com/groups/<GROUP_ID>"
```

Wait 6-8 seconds for the group feed to load.

### Check group status

**Problem:** Groups can be paused by admins. A paused group shows a banner like:

> "Este grupo se pausó temporalmente por X días. Un administrador pausó este grupo el DD de mes de YYYY. Se reanudará el DD de mes de YYYY."

**Solution:** Before scraping posts, check `document.body.innerText` for "pausó" or "reanudará". If paused, skip scraping and note the resume date.

```javascript
async () => {
  const text = document.body.innerText;
  const paused = text.includes('pausó') || text.includes('reanudará');
  return JSON.stringify({paused, snippet: text.substring(0, 500)});
}
```

### Sort posts by recency

By default, Facebook shows "Más relevantes" (algorithmic sort). To see recent posts:

1. Click the sort button: `button "ordenar feed del grupo por Más relevantes"`
2. Select "Publicaciones nuevas": `menuitemradio "Publicaciones nuevas"`

```bash
SORT_REF=$(node scripts/browser.js exec snapshot 2>/dev/null | grep 'ordenar feed del grupo por' | sed 's/.*\[ref=\(f[0-9a-f]*\)\].*/\1/')
node scripts/browser.js exec click $SORT_REF
sleep 2
RECENT_REF=$(node scripts/browser.js exec snapshot 2>/dev/null | grep "Publicaciones nuevas" | sed 's/.*\[ref=\(f[0-9a-f]*\)\].*/\1/')
node scripts/browser.js exec click $RECENT_REF
```

### Extract posts

Facebook does not use stable `data-testid` attributes for posts. Use `[role="article"]` or text-based extraction:

```javascript
async () => {
  const all = document.body.innerText;
  const lines = all.split('\n').filter(l =>
    l.length > 25 &&
    !l.includes('Facebook') &&
    !l.includes('Escribe') &&
    !l.includes('comentario') &&
    !l.includes('Cualquier') &&
    !l.includes('Grupo de')
  );
  return JSON.stringify(lines.slice(0, 40));
}
```

### Scroll to load more posts

Facebook lazy-loads posts. Scroll gradually to trigger loading:

```javascript
async () => {
  window.scrollBy(0, 2000);
  return 'scrolled';
}
```

Wait 3-4 seconds after each scroll for new posts to render. Repeat as needed.

**Gotcha:** Facebook may load unrelated content (spam, religious posts, ads) in mixed groups. Filter by keywords relevant to your search.

### Extract post author and content

Posts appear as: `<Author Name>` followed by the post text. Parse consecutive lines:

```javascript
async () => {
  const lines = document.body.innerText.split('\n');
  const posts = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.includes('<KEYWORD>')) {
      const author = lines[i-1] || '';
      posts.push({author, content: l.substring(0, 200)});
    }
  }
  return JSON.stringify(posts);
}
```

## Gotchas and anti-patterns

### Groups can be paused

**Problem:** Admins can pause groups for any duration. A paused group shows no new posts and has a banner explaining the pause.

**Solution:** Check for pause banners before scraping. Note the resume date and return later.

### Heavy spam in open groups

**Problem:** Public groups with no moderation fill with spam (religious posts, unrelated ads, motivational content). Relevant posts are buried.

**Solution:** Use keyword filtering on extracted text. Do not assume every `role="article"` is a relevant post. Filter by topic-specific keywords.

### DOM changes frequently

**Problem:** Facebook updates its DOM structure frequently. Selectors like `[data-testid="feed-post-container"]` may work one day and fail the next.

**Solution:** Prefer `document.body.innerText` text extraction over DOM selectors. Parse text content with string matching. This is more resilient to DOM changes.

### Multiple tabs accumulate

**Problem:** Navigating to Facebook groups often opens new tabs (e.g. group search results, suggested groups). These accumulate and consume memory.

**Solution:** Periodically check open tabs and close unnecessary ones. Focus on the target group tab.

### Scroll does not always load more

**Problem:** Sometimes scrolling does not trigger lazy loading. The page appears stuck.

**Solution:** Try scrolling in smaller increments (500-1000px). Wait longer between scrolls (4-5 seconds). If still stuck, the group may have no more posts to load.

## Validation

**Validated:** 2026-08-21 against live Facebook Groups.

## Anti-patterns

- **Do NOT assume a group is active.** Check for pause banners first.
- **Do NOT rely on DOM selectors alone.** Facebook changes its DOM frequently. Use text extraction as fallback.
- **Do NOT attempt to log in programmatically.** Always use headed mode for manual login.
- **Do NOT scrape without keyword filtering.** Open groups contain spam and irrelevant content.
- **Do NOT forget to sort by recency.** Default sort is algorithmic, not chronological.
