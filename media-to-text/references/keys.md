# API Keys — provisioning

## Resolucion (lib/keys.sh)

Orden de busqueda para cada provider:

1. Variable de entorno: `GROQ_API_KEY` / `GEMINI_API_KEY` (o `GOOGLE_API_KEY`)
2. `./.env` en el cwd del repo que consume la skill
3. `~/.config/devin/secrets/groq.key` / `gemini.key` (chmod 600)

Las keys pueden ser **temporales a proposito** (ej. 30 days en Groq) — el sistema
espera renovarlas, no son infraestructura permanente.

## Regla de oro

**Nunca headless para logins, registros o captchas.** Si hay que crear una key:

1. Verificar si el agente tiene browser visible disponible (browser-automation
   con `headed: true`, o pedirle al usuario que abra el navegador del pod).
2. Si lo tiene: ejecutar el flujo con la sesion del usuario (Google OAuth suele
   estar logueado). Si aparece captcha/Turnstile, pedir al usuario que lo
   resuelva en pantalla — el agente NO lo resuelve.
3. Si no puede (sin pantalla, captcha bloqueado, login requerido): dar al
   usuario los pasos exactos y pedirle la key. El usuario la pega y se guarda.

## Groq — console.groq.com

Pasos validados 2026-11-20 (flujo real con Google OAuth):

1. `https://console.groq.com/keys` — si no hay sesion, "Continue with Google"
   (la mayoria de los usuarios ya tiene la sesion Google en el browser).
2. Click **Create API Key**.
3. **Display Name**: `media-to-text` (o el nombre que pida el contexto).
4. **Expiration**: elegir la maxima disponible (30/60/90 days o custom).
   Anotar la fecha de expiracion — la key muere sola.
5. **Cloudflare Turnstile**: aparece en el form. En modo invisible puede no
   renderizar el iframe; si el boton Submit no aparece, verificar que el widget
   se renderizo. Si persiste el bloqueo, pedir al usuario que complete el
   desafio en el browser visible.
6. Al crear, Groq muestra la key **una sola vez** — copiarla inmediatamente.
7. Guardar: `echo 'gsk_...' > .env` (gitignored) o
   `~/.config/devin/secrets/groq.key` (chmod 600).
8. Verificar: `curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $KEY" https://api.groq.com/openai/v1/models` → 200.

### Gotchas conocidos

- Turnstile NO renderiza en headless ni en algunos entornos (IP datacenter).
  Sintoma: `#cf-turnstile` vacio, sin iframe, sin boton Submit.
- Workaround tecnico (solo si el usuario ya resolvio el captcha una vez): el
  token queda en `input[name=cf-turnstile-response]`; si el componente React no
  se entera, invocar su `onSuccess` via React fiber para mostrar Submit.
- La key nueva no aparece en la lista hasta recargar; el dialog de exito la
  muestra una unica vez.

## Gemini — aistudio.google.com

Pasos validados 2026-11-20:

1. `https://aistudio.google.com/api-keys` — login con Google (misma sesion).
2. **Crear clave de API**.
3. **Nombre**: `media-to-text`.
4. **Proyecto**: recomendado crear uno dedicado (**Crear proyecto** → nombre
   `media-to-text`) para aislar quotas y facturacion del resto de proyectos GCP.
   Alternativa: usar un proyecto existente.
5. Click **Crear clave** → dialog "Detalles de la clave de API" muestra la key
   `AIza...` o formato nuevo `AQ.xxx` con boton **Copiar clave**.
6. Guardar: `GEMINI_API_KEY=...` en `.env` o `~/.config/devin/secrets/gemini.key`.
7. Verificar: `curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=$KEY" | jq '.models|length'` → >0.

### Gotchas conocidos

- Las keys nuevas pueden tardar ~30s en propagar (un 401 inicial no es fatal —
  reintentar).
- Los modelos `gemini-2.5-*` pueden devolver 404 "no longer available to new
  users" — usar `gemini-flash-latest` (alias estable) o `gemini-3.x`.
- No hay captcha en el flujo normal de AI Studio.

## Cuando la key vence

- Groq: la API devuelve 401/403. El script falla limpio → provisionar nueva.
- Gemini: las keys de AI Studio no expiran solas, pero pueden revocarse.
- En ambos casos: NO hacer fallback silencioso a whisper local. Pedir nueva key
  al usuario o provisionarla segun la regla de oro.
