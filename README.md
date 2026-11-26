# AI Skills by galiprandi

Reusable skills for AI agents: browser and device automation, personal-assistant data management, media extraction, voice output, and agent workflow discipline.

[![skills.sh](https://skills.sh/b/galiprandi/skills)](https://skills.sh/galiprandi/skills)

## Installation

Requires Node.js 22.20 or later.

Install one skill into the current project:

```bash
npx skills add galiprandi/skills --skill <skill-name>
```

Install one skill globally:

```bash
npx skills add galiprandi/skills --skill <skill-name> -g
```

Install one skill for a specific agent:

```bash
npx skills add galiprandi/skills --skill <skill-name> -a <agent-name>
```

Install one skill from its direct repository path:

```bash
npx skills add https://github.com/galiprandi/skills/tree/main/<skill-name>
```

List available skills without installing:

```bash
npx skills add galiprandi/skills --list
```

Choose skills interactively:

```bash
npx skills add galiprandi/skills
```

Update installed skills:

```bash
npx skills update
```

Avoid installing every skill blindly: some are environment-specific and require private infrastructure, credentials, devices, or MCP servers.

## Skills inventory

| Skill | Use when | Requires | Audience |
|---|---|---|---|
| `acp-connector` | Scheduling follow-ups, snoozed checks, or recurring jobs through the acp-connector bridge | acp-connector MCP environment | Environment-specific |
| `agent-desk` | Managing tasks, events, sessions, and relationships in agent-desk | agent-desk deployment, `browser-automation` | Environment-specific |
| `android-automation` | Controlling Android apps or devices through adb | adb, Android device or emulator | General |
| `assistant` | Managing people/contact data with Google Contacts semantics, CSV fallback, deduplication, and write-safety rules | Google account or local CSV; `browser-automation` for UI work | Personal assistants/bots |
| `autogen` | Extracting a successful workflow into a reusable skill | Existing agent workflow worth preserving | Meta/agent maintenance |
| `browser-automation` | Automating authenticated web apps in a real browser | Node.js, Chrome, `agent-browser` | General |
| `context-organizer` | Maintaining repository context files and behavior documentation | Repository with docs/tests | Opinionated/general |
| `litellm-sources` | Answering LiteLLM questions only from current official sources | Network access to LiteLLM sources | Specialized |
| `media-to-text` | Converting images, audio, video, and PDFs into text | Groq/Gemini API access; local PDF tools when available | General, key-dependent |
| `react-tools` | Using `@galiprandi/react-tools` components and hooks correctly | React project using that library | General |
| `remote-desktop` | Letting a human temporarily control the machine for login, captcha, or visual inspection | Remote desktop/tunnel setup | Environment-specific |
| `tts` | Converting text or digests into speech audio | `edge-tts` | General |

## How this repository is organized

- Each skill lives in a root-level directory named after the skill.
- `<skill>/SKILL.md` is the agent-facing entrypoint.
- `references/` contains detailed optional documentation.
- `templates/` contains schemas or copyable artifacts.
- `scripts/` contains executable support code when needed.
- `sites/` contains site-specific browser automation guides.

The README is only the discovery and installation index. Operational behavior belongs in each `SKILL.md`.

## Security and privacy

- Do not commit secrets, credentials, browser profiles, downloads, or real personal data.
- Templates must contain schemas or clearly fake examples only.
- Browser automation may operate authenticated sessions; verify account identity before acting.
- Environment-specific skills can expose private infrastructure or workflows. Install them only in the environment they were designed for.
- Pull requests are scanned by SkillSpector for prompt-injection, data-exfiltration, and supply-chain risks.

## Contributing

- Keep one skill per directory.
- Keep `SKILL.md` concise and information-dense; move detail to `references/`.
- Update this inventory whenever a skill is added, renamed, removed, or changes purpose.
- Do not duplicate browser/UI mechanics outside `browser-automation`; reference it instead.
- Run relevant validation or smoke checks before submitting changes.

## License

MIT License. See [LICENSE](LICENSE).
