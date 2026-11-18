---
name: tts
description: Convert text to speech audio with edge-tts (neural voices, incl. es-AR). Use when the user asks for an audio version of a message, digest, reminder or any text — e.g. "mandámelo en audio", "leeme esto", podcast-style summaries. Covers filename conventions for keeping an audio history.
allowed-tools: Bash(edge-tts:*) Bash(ffmpeg:*) Bash(cp:*)
metadata:
  author: galiprandi
  tags: [tts, audio, edge-tts, telegram, accessibility]
---

# TTS — text to speech with edge-tts

Generates natural neural voices via Microsoft's Edge TTS service. No API key needed; requires `edge-tts` (Python package, `pip install edge-tts`) and outbound HTTPS.

## Command

```bash
edge-tts --voice <VOICE> --text "<texto>" --write-media <output.mp3>
```

For long texts, pass the text via stdin or a file to avoid shell-quoting issues:

```bash
echo "Texto largo..." | edge-tts --voice es-AR-ElenaNeural --write-media out.mp3
```

## Voices

- `es-AR-ElenaNeural` — Spanish (Argentina), female. Default for es-AR content.
- `es-AR-TomasNeural` — Spanish (Argentina), male.
- `es-ES-ElviraNeural` / `es-ES-AlvaroNeural` — Spain variants.
- `en-US-AriaNeural`, `en-US-GuyNeural` — English.
- List all: `edge-tts --list-voices | grep es-`

## Filename convention (IMPORTANT)

The filename MUST describe the content, not be generic — audio files accumulate as a history and must be easy to find later.

Pattern: `<tipo>-<tema>-<fecha>.<ext>`

Examples:
- `digest-noticias-2026-11-18.mp3`
- `briefing-diario-2026-11-19.mp3`
- `recordatorio-pagar-renta-2026-11-20.mp3`
- `resumen-reunion-ntt-2026-11-21.mp3`

Rules:
- Lowercase, kebab-case, no spaces.
- Always include an ISO date (`YYYY-MM-DD`).
- Never use `audio.mp3`, `output.mp3`, `tts.mp3`, `test.mp3`.

## Where to save

- For sending via chat bridge: save inside the agent workspace (e.g. `uploads/` — gitignored, persists) then deliver with the channel's file-send tool.
- For a local audio history: a dedicated dir like `~/audio/` or `<workspace>/tts-history/` (gitignored) so files stay searchable by name.
- Never commit generated audio to git.

## Delivery notes

- MP3 output plays everywhere (Telegram, WhatsApp voice-note players treat it as a file, not a voice note — that's fine).
- If the user wants a WhatsApp *voice note* (round playable bubble), edge-tts MP3 must be converted to OGG/Opus with ffmpeg: `ffmpeg -i in.mp3 -c:a libopus out.ogg`. Only do this when asked.
- Keep the spoken text clean: strip markdown, emojis read awkwardly (remove them or replace with words), expand abbreviations.
