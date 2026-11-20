# Providers — media-to-text

## Groq (STT bulk)

- **Endpoint**: `https://api.groq.com/openai/v1/audio/transcriptions`
- **Modelo**: `whisper-large-v3-turbo` (rapido, buena precision en es/en)
- **Free tier**: 20 RPM, 2.000 req/dia, 7.200 seg audio/hora (~2hs/h), 28.800 seg/dia (~8hs/dia), upload <25MB
- **Uso ideal**: audio/video largo (>10min), cursos, reuniones, podcasts
- **Nuestro pacing**: budget conservador 6.000 seg/hora (`GROQ_ASH_BUDGET`),
  ventana deslizante en `/tmp/groq-ash-usage.log`
- **Provisioning**: `console.groq.com` → API Keys → Create (Turnstile captcha,
  requiere browser visible)

## Gemini (multimodal nativo)

- **Endpoint**: `generativelanguage.googleapis.com/v1beta`
- **Modelo default**: `gemini-flash-latest` (alias estable; override con `GEMINI_MODEL`)
- **Free tier**: generoso — Flash ~10 RPM / 250 req/dia, File API hasta 2GB/archivo,
  contexto 1M tokens
- **Uso ideal**: imagenes (OCR+descripcion), audio/video corto, PDF escaneado,
  documentos complejos
- **File API**: upload resumable para archivos >=20MB; inline base64 <20MB
- **Provisioning**: `aistudio.google.com` → Get API key (login Google, sin captcha)

## Local (sin API)

- `pdftotext` (poppler-utils) — PDF con capa de texto
- Whisper local — NO usar salvo fallback explicitamente pedido (CPU/disco pesados)

## Fuera de scope (documentado, no implementado)

- **Mistral OCR** (`mistral-ocr-latest`): el mejor para documentos manuscritos y
  OCR de alta precision, pero es pago (~$2/1000 paginas). Recomendacion: si el
  usuario tiene MUCHOS documentos manuscritos/escaneos, sugerirle comprar
  creditos en `console.mistral.ai` y pasar la key. Gemini alcanza para uso
  ocasional.
- **OpenRouter**: free tier debil para media (~50-1000 req/dia, Whisper via OR
  es pago). No es provider principal; puede servir como LLM de texto complementario.

## Decision rapida

```
¿Texto en PDF?           -> pdftotext local
¿Foto/imagen?            -> Gemini
¿Audio/video corto?      -> Gemini
¿Audio/video largo?      -> Groq
¿Muchos docs manuscritos?-> sugerir Mistral OCR pago
```
