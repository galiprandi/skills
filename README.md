# AI Skills by galiprandi

> 🚀 Supercharge your AI coding assistant with specialized skills

This repository contains AI skills that enhance your coding experience with tools like Claude Code, Cursor, Windsurf, and other AI-powered development environments.

## 🎯 What are AI Skills?

AI Skills are specialized knowledge modules that teach your AI assistant how to work with specific libraries, frameworks, and tools. Instead of explaining the same concepts repeatedly, you can install a skill once and your AI assistant will have instant expertise.

## 📦 Available Skills

### Browser Automation ⭐

**browser-automation** — Control a dedicated browser via playwright-cli for web automation. Covers generic browser operations (golden rules, safe wrapper, parallel sessions, profile management) plus site-specific guides for Gmail, LinkedIn, Teams, Jira, Teamtailor, and Humand.co — loaded on demand to save tokens.

**What it helps with:**
- Browser automation with persistent profiles (never commit the profile dir)
- Safe wrapper that prevents race conditions and zombie sessions
- Tab and session management for parallel subagent work
- 6 validated golden rules (eval > refs, in-page polling > sleep, batch operations, etc.)
- Token-efficient patterns (shallow snapshot, find, batch eval)
- Auth state persistence across browser restarts
- Profile management, headed/headless workflow, config via file or env var
- Site-specific guides: Gmail (Atom feed, native value setter, reply vs compose), LinkedIn (Voyager API, tiptap fix, Easy Apply, connection requests), Teams (chatsvc API, token extraction), Jira (issue creation, custom dropdowns), Teamtailor & Humand.co (job application flows)
- Self-improving: agents that discover broken selectors or shortcuts can contribute learnings back via draft PRs (with scrubbing, privacy gates, and human confirmation)

**Perfect for:**
- Automating web apps that require login
- Scraping data from authenticated sites
- Testing web flows
- Any task needing a real browser session
- Job search automation, recruiter outreach, inbox management

**Includes:**
- `scripts/browser.js` — safe wrapper (copy to your repo's `scripts/` dir)
- `references/parallel-agents.md` — subagent pattern with sessions and ref-count
- `references/profile-management.md` — profile dir, auth state, headed/headless
- `references/playwright-cli.md` — full command reference
- `references/ats-patterns.md` — ATS-specific patterns (Ashby, scheduling links)
- `sites/gmail_com/guide.md` — Gmail guide (Atom feed, compose, reply, search, shortcuts, SMTP)
- `sites/linkedin_com/guide.md` — LinkedIn guide (Voyager API, messaging, Easy Apply, connections, tiptap fix)
- `sites/linkedin_com/voyager-api.md` — Voyager endpoint documentation
- `sites/teams_com/guide.md` — Teams guide (chatsvc API, token extraction, chatId formats)
- `sites/jira_com/guide.md` — Jira guide (issue creation, custom dropdowns, transitions)
- `sites/teamtailor_com/guide.md` — Teamtailor guide (Apply with LinkedIn, API POST, email verification)
- `sites/humand_co/guide.md` — Humand.co guide (guest session, S3 CV upload, API apply)
- `sites/CONTRIBUTING.md` — contribution guidelines, naming conventions, security checklist

**Security:**
- SkillSpector CI scans every PR to `browser-automation/` for prompt injection, data exfiltration, and supply-chain attacks
- `sites/` is markdown-only (no executable scripts) — prevents RCE via contributed code
- Learnings are documentation only, never auto-applied by the agent
- Privacy gate: agents never offer to contribute learnings from internal/private sites
- PR scope enforcement: contributions to `sites/` cannot touch core files (`SKILL.md`, `scripts/`, `references/`)

### React Tools

**@galiprandi/react-tools** - A lightweight, dependency-free utility library for React that provides reusable components and hooks to simplify development and improve accessibility.

**What it helps with:**
- Async data handling with automatic cancellation
- Form management with built-in validation
- Browser-native AI features (Chrome AI API with multimodal support)
- Accessible dialogs and modals
- Performance optimization (lazy loading, viewport tracking)
- Common React patterns (debounce, timers, list management)

**Perfect for:**
- React web applications
- Form-heavy interfaces
- AI-powered features
- Performance-critical UIs

### Context Organizer

**context-organizer** - A skill for managing and optimizing the context within AI coding environments, including optimizing the storage and retrieval of technical information, rewriting ambiguous test descriptions, and compiling clean and structured documentation.

**What it helps with:**
- Optimizing the storage and retrieval of technical information
- Rewriting ambiguous test descriptions
- Compiling clean and structured documentation

**Perfect for:**
- AI coding environments
- Technical documentation
- Test description optimization

## 🛠️ Installation

```bash
npx skills add https://github.com/galiprandi/skills
```

To update all installed skills to the latest version (recommended before starting any browser automation task — site selectors break over time):

```bash
npx skills update
```

## 💡 How to Use

Once installed, your AI assistant will automatically have access to the skill's knowledge. Simply ask questions like:

- "Read my Gmail inbox and summarize unread messages"
- "Send a LinkedIn message to María"
- "Apply to the job posting at company.teamtailor.com"
- "How do I use AsyncBlock for API data fetching?"
- "Show me how to create a form with validation"

Your AI assistant will provide accurate, context-aware answers based on the skill's documentation.

## ✨ Benefits

- **Save Time**: No need to explain library specifics repeatedly
- **Better Code**: Get consistent, best-practice implementations
- **Stay Updated**: Skills are maintained with the latest library features
- **Expert Guidance**: Access specialized knowledge instantly
- **Reduced Hallucinations**: AI assistant has accurate documentation to reference

## 🔒 Security

All skills in this repository undergo security assessments:

- ✅ SkillSpector CI scans for prompt injection, data exfiltration, and supply-chain attacks
- ✅ No executable scripts in `sites/` — markdown documentation only
- ✅ Learnings are never auto-applied by the agent (documentation, not instructions)
- ✅ Privacy gate prevents contributing learnings from internal/private sites
- ✅ PR scope enforcement — contributions cannot touch core skill files
- ✅ Transparent source code

Review security details at [skills.sh/galiprandi/skills](https://skills.sh/galiprandi/skills)

## 🤝 Contributing

Suggestions and improvements are welcome! Feel free to:

- Report issues with existing skills
- Request new skills for libraries you use
- Share feedback on skill effectiveness

## 📄 License

MIT License - Feel free to use these skills in your projects.

## 🔗 Links

- [React Tools Library](https://github.com/galiprandi/react-tools)
- [Skills.sh Documentation](https://skills.sh)
- [Report Issues](https://github.com/galiprandi/skills/issues)

---

**Built with ❤️ for developers who want smarter AI assistants**
