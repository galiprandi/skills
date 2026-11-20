---
name: media-to-text
description: Convierte imagenes, audio, video y PDF a texto usando APIs externas (Groq Whisper para media larga, Gemini para imagen/audio/video/PDF). Usar cuando el agente reciba archivos multimedia, fotos, audios, videos o PDFs escaneados y el modelo no pueda procesarlos directamente. Cubre OCR, transcripcion y descripcion de contenido visual.
---

# media-to-text

Pipeline self-contained para extraer texto de cualquier archivo media. Los agentes
text-only NO deben intentar abrir/interpretar media directamente — siempre pasar
por `media2text` y razonar sobre el texto extraido.

## Uso

```bash
scripts/media2text <archivo|url> [--out salida.txt] [--provider auto|groq|gemini] [--prompt "..."] [--lang es]
```

- `--out` default: `<basename>.txt` en el cwd.
- `--provider auto` (default) rutea solo; forzar solo si el usuario lo pide.
- `--prompt` pisa el prompt por defecto del tipo de archivo.

## Routing automatico

| Entrada | Provider | Por que |
|---|---|---|
| pdf con texto | `pdftotext` local | Gratis, instantaneo |
| pdf escaneado | Gemini | OCR multimodal |
| imagen (png/jpg/webp/gif...) | Gemini vision | Descripcion + OCR en un paso |
| audio/video >10min o URL pesada | Groq `whisper-large-v3-turbo` | Bulk barato (~8hs audio/dia free), chunks de 15min con pacing de rate limit, cache reanudable, streaming sin descargar video |
| audio/video <=10min | Gemini | Multimodal nativo, transcribe + describe |

## Reglas para el agente

1. **Nunca procesar media directo.** Si el usuario manda foto/audio/video/PDF,
   correr `media2text` primero y trabajar sobre el `.txt` resultante.
2. **Keys**: ver `references/keys.md`. Si falta o vencio una key, provisionarla
   (browser visible del usuario) o pedirle al usuario que la cree — NUNCA usar
   headless para logins/registros/captchas.
3. **Salida**: texto plano `.txt`. Para descripciones/OCR extensos el output
   puede ser markdown — esta bien, guardarlo como `.md` con `--out`.
4. **Colas largas**: si hay muchos videos/audio (>30min c/u), NO correr en
   foreground bloqueante — lanzar en background (`nohup ... &`) o crear un job
   del conector con patron auto-eliminable (ver `references/agent-rules.md`).
5. **Privacidad**: la media se envia a APIs de terceros (Groq/Google). Avisar
   si el contenido es sensible antes de procesar.
6. **Limpieza de fuentes (disco)**: los archivos media suelen ser muy pesados
   (videos de GBs). Después de una transcripcion exitosa, **recomendar
   proactivamente al usuario eliminar el archivo fuente** para ahorrar espacio:
   "La transcripcion salio bien. El video pesa X GB — ¿querés que lo elimine
   para ahorrar espacio en disco?". NUNCA borrar sin confirmacion del usuario.
   Aplica a videos, audios y PDFs pesados; para imagenes pequenas no hace falta.

## Scripts

- `scripts/media2text` — entry point unico (dispatcher + routing)
- `scripts/lib/groq-stt.sh` — STT bulk Groq (chunks, pacing, cache)
- `scripts/lib/gemini-media.sh` — Gemini inline (<20MB) o File API (hasta 2GB)
- `scripts/lib/keys.sh` — resolucion de keys: env -> ./.env -> secrets dir

## Referencias

- `references/providers.md` — providers, modelos, rate limits, cuando pagar
- `references/keys.md` — provisioning de API keys (auto vs guiado)
- `references/agent-rules.md` — reglas de comportamiento y patron job
