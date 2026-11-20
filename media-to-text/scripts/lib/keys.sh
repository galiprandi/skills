#!/bin/bash
# Resolucion de API keys para media-to-text.
# Orden: env var -> .env del repo (cwd) -> ~/.config/devin/secrets/
# Uso: source lib/keys.sh ; groq_key ; gemini_key

_m2t_env_get() { # $1=var, $2=default file .env en cwd
  local var=$1 val=""
  val=$(printenv "$var" 2>/dev/null)
  [ -n "$val" ] && { echo "$val"; return 0; }
  if [ -f ./.env ]; then
    val=$(grep -E "^\s*${var}\s*=" ./.env | tail -1 | cut -d= -f2- | tr -d '"'"'"' \r')
    [ -n "$val" ] && { echo "$val"; return 0; }
  fi
  return 1
}

groq_key() {
  _m2t_env_get GROQ_API_KEY || cat "$HOME/.config/devin/secrets/groq.key" 2>/dev/null
}

gemini_key() {
  _m2t_env_get GEMINI_API_KEY || _m2t_env_get GOOGLE_API_KEY || cat "$HOME/.config/devin/secrets/gemini.key" 2>/dev/null
}

# Imprime instrucciones de provisioning y retorna 1. Llamar cuando falte key.
m2t_need_key() { # $1=provider (groq|gemini)
  cat >&2 <<EOF
ERROR: falta API key de $1.

Como obtenerla (auto-servicio):
EOF
  case "$1" in
    groq)
      cat >&2 <<'EOF'
- console.groq.com -> login con Google/GitHub -> API Keys -> Create API Key
- Nombre sugerido: media-to-text | Expiration: 30 days (o la maxima disponible)
- Free tier: ~8hs audio/dia, uploads <25MB
- Guardar en ./.env como GROQ_API_KEY=gsk_...  (o ~/.config/devin/secrets/groq.key)
- OJO: el form tiene Cloudflare Turnstile -> si no renderiza, pedir al usuario
  que lo resuelva en el browser visible (NUNCA headless para registros).
EOF
      ;;
    gemini)
      cat >&2 <<'EOF'
- aistudio.google.com -> login con Google -> "Get API key" / Claves de API
- Crear clave (se puede crear proyecto nuevo dedicado, ej. media-to-text)
- Free tier generoso: Gemini 2.5 Flash/Pro, File API hasta 2GB
- Guardar en ./.env como GEMINI_API_KEY=AIza...  (o ~/.config/devin/secrets/gemini.key)
EOF
      ;;
  esac
  return 1
}
