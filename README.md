# AI Skills by galiprandi

> 🚀 Supercharge your AI coding assistant with specialized skills

This repository contains AI skills that enhance your coding experience with tools like Claude Code, Cursor, Windsurf, and other AI-powered development environments.

## 🎯 What are AI Skills?

AI Skills are specialized knowledge modules that teach your AI assistant how to work with specific libraries, frameworks, and tools. Instead of explaining the same concepts repeatedly, you can install a skill once and your AI assistant will have instant expertise.

## 📦 Available Skills

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

### Browser Automation

**browser-automation** - Control a dedicated browser via playwright-cli for web automation. One skill that covers generic browser operations (golden rules, safe wrapper, parallel sessions, profile management) plus app-specific guides (Gmail, LinkedIn, and more) loaded on demand.

**What it helps with:**
- Browser automation with persistent profiles (never commit the profile dir)
- Safe wrapper that prevents race conditions and zombie sessions
- Tab and session management for parallel subagent work
- 6 validated golden rules (eval > refs, in-page polling > sleep, batch operations, etc.)
- Token-efficient patterns (shallow snapshot, find, batch eval)
- Auth state persistence across browser restarts
- Profile management, headed/headless workflow, config via file or env var
- App-specific guides: Gmail (Atom feed, native value setter, reply vs compose), LinkedIn (Voyager API, tiptap fix, Easy Apply, connection requests)

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
- `apps/gmail.md` — Gmail guide (Atom feed, compose, reply, search, shortcuts, SMTP)
- `apps/linkedin.md` — LinkedIn guide (Voyager API, messaging, Easy Apply, connections, tiptap fix)
- `apps/linkedin-references/voyager-api.md` — Voyager endpoint documentation

## 🛠️ Installation

```bash
npx skills add https://github.com/galiprandi/skills
```

## 💡 How to Use

Once installed, your AI assistant will automatically have access to the skill's knowledge. Simply ask questions like:

- "How do I use AsyncBlock for API data fetching?"
- "Show me how to create a form with validation"
- "Help me implement lazy loading for images"
- "What's the best way to handle async data in React?"

Your AI assistant will provide accurate, context-aware answers based on the skill's documentation.

## ✨ Benefits

- **Save Time**: No need to explain library specifics repeatedly
- **Better Code**: Get consistent, best-practice implementations
- **Stay Updated**: Skills are maintained with the latest library features
- **Expert Guidance**: Access specialized knowledge instantly
- **Reduced Hallucinations**: AI assistant has accurate documentation to reference

## 🔒 Security

All skills in this repository undergo security assessments:

- ✅ Code scanning for vulnerabilities
- ✅ Dependency analysis
- ✅ Safe execution patterns
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
