# Agent rules — comportamiento y colas largas

## Reglas duras

1. **Media → texto siempre via `media2text`.** El agente razona sobre el `.txt`
   output, nunca sobre el binario. Si el usuario adjunta media en el chat,
   guardarla a disco y procesarla.
2. **Nunca headless para logins/registros/captcha.** Provisioning de keys o
   cualquier flujo con auth: browser visible o pedir ayuda al usuario.
3. **No whisper local** como camino normal — solo fallback explicitamente
   pedido por el usuario (consume CPU/disco).
4. **Avisar antes de enviar media a terceros** si el contenido es sensible
   (documentos personales, credenciales visibles, etc.).
5. **No commitear keys.** `.env` debe estar gitignored; secrets dir con 600.
6. **Limpiar fuentes pesadas**: tras transcripcion exitosa de video/audio/PDF
   pesado, ofrecer borrarlo: "salio bien, el archivo pesa X — ¿lo elimino
   para ahorrar disco?". Siempre con confirmacion explicita; nunca automatico.
   Reportar el tamano ahorrado.

## Convenciones de output

- Default: `<basename>.txt` en el directorio de trabajo o `--out` explicito.
- Transcripciones: texto corrido por defecto (Whisper). Si el usuario pide
  timestamps o formato distinto, ajustar el prompt/provider.
- OCR/descripciones: Gemini devuelve markdown estructurado — guardar como `.md`.
- Nombre de salida: slug del contenido, no nombres temporales.

## Colas largas (muchos videos/audio)

Problema: una cola de videos largos puede tardar horas por rate limits.

** Patron recomendado (usado en producción en escribania):**

1. Script idempotente: saltea items que ya tienen output.
2. Cache por item para reanudar si se corta.
3. Lanzar en background (`nohup script > log 2>&1 &`) — NO en foreground
   bloqueante (bloquearia la cola del bridge/agente).
4. Job del conector (acp-connector `jobs`) cada ~1h que:
   - verifica pendientes
   - lanza el proceso solo si no esta corriendo
   - reporta progreso
   - **se autoborra cuando la cola llega a 0**
5. Nada de servicios pm2/residentes para trabajo temporal.

## Errores comunes

- `Rate limit reached ... seconds of audio per hour` (Groq): normal en colas
  grandes — el script pacea solo, no reintentar a mano.
- Gemini 404 en `gemini-2.5-flash`: usar `gemini-flash-latest`.
- Gemini 401 inicial con key recien creada: esperar ~30s y reintentar.
- ffmpeg "Option not found" con `-user_agent` en archivo local: ya corregido
  en lib/groq-stt.sh (solo URLs).
- Turnstile sin render en Groq console: entorno bloqueado por Cloudflare;
  derivar al usuario.
