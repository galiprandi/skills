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

## Naming + metadata (IMPORTANT)

Every generated audio MUST carry a short human title and a brief description as embedded metadata — audio files accumulate as a history and must be easy to find and identify later, both in the filesystem and inside the player's info panel.

### Filename

Short, descriptive title — NO kebab-case, NO forced pattern. Spaces and natural punctuation are fine:

- `Digest noticias 18-11.mp3`
- `Briefing diario.mp3`
- `Recordatorio renta.mp3`
- `Resumen reunion NTT.mp3`

Still include the date in the name or metadata when it matters (recurring content). Never use `audio.mp3`, `output.mp3`, `tts.mp3`, `test.mp3`.

### Embedded metadata (ID3)

edge-tts does not write tags — post-process with ffmpeg (`-c copy`, no re-encode, instant):

```bash
ffmpeg -y -i in.mp3 -c copy \
  -metadata title="Digest noticias - 18 nov" \
  -metadata comment="Resumen diario de feeds: agentes IA, reescritura de curl en Rust." \
  out.mp3
```

- `title`: same short title as the filename (without extension).
- `comment`: 1-2 sentence description of the content — what it is, main topics, source if relevant.
- Write tags BEFORE sending/saving the final file; overwrite in place or write to the final name directly.

## Where to save

- For sending via chat bridge: save inside the agent workspace (e.g. `uploads/` — gitignored, persists) then deliver with the channel's file-send tool.
- For a local audio history: a dedicated dir like `~/audio/` or `<workspace>/tts-history/` (gitignored) so files stay searchable by name.
- Never commit generated audio to git.

## Delivery notes

- MP3 output plays everywhere (Telegram, WhatsApp voice-note players treat it as a file, not a voice note — that's fine).
- If the user wants a WhatsApp *voice note* (round playable bubble), edge-tts MP3 must be converted to OGG/Opus with ffmpeg: `ffmpeg -i in.mp3 -c:a libopus out.ogg`. Only do this when asked.
- Keep the spoken text clean: strip markdown, emojis read awkwardly (remove them or replace with words), expand abbreviations.
