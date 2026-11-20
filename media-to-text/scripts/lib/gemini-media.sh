#!/bin/bash
# gemini-media.sh — descripcion/transcripcion/OCR de imagen, audio, video o PDF
# via Gemini API (multimodal nativo).
# Uso: gemini-media.sh <file> <output.txt> [prompt] [mime]
# - <20MB: inline base64 | >=20MB (hasta 2GB): File API resumable upload
# - Modelos: GEMINI_MODEL env (default gemini-2.5-flash)
# Requiere: curl, jq, base64 + lib/keys.sh (gemini_key)
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
source "$HERE/keys.sh"

FILE=${1:?uso: gemini-media.sh <file> <output.txt> [prompt] [mime]}
OUT=${2:?falta output.txt}
PROMPT=${3:-}
MIME=${4:-}
KEY=$(gemini_key) || { m2t_need_key gemini; exit 1; }
MODEL=${GEMINI_MODEL:-gemini-flash-latest}
API="https://generativelanguage.googleapis.com"

[ -f "$FILE" ] || { echo "ERROR: no existe $FILE" >&2; exit 1; }
SIZE=$(stat -c%s "$FILE" 2>/dev/null || echo 0)

if [ -z "$MIME" ]; then
  MIME=$(file -b --mime-type "$FILE" 2>/dev/null)
  case "$MIME" in
    application/octet-stream|inode/*) MIME="" ;;
  esac
  [ -z "$MIME" ] && MIME=$(echo "$FILE" | grep -oE '\.[a-z0-9]+$' | tr -d '.' | \
    awk '{print tolower($1)}' | while read e; do case $e in
      png) echo image/png;; jpg|jpeg) echo image/jpeg;; webp) echo image/webp;;
      gif) echo image/gif;; mp3) echo audio/mpeg;; wav) echo audio/wav;;
      ogg) echo audio/ogg;; mp4) echo video/mp4;; mov) echo video/quicktime;;
      webm) echo video/webm;; pdf) echo application/pdf;; m4a) echo audio/mp4;;
      *) echo application/octet-stream;; esac; done)
fi

# Prompt por defecto segun tipo
if [ -z "$PROMPT" ]; then
  case "$MIME" in
    image/*) PROMPT="Describe esta imagen en detalle y extrae TODO el texto visible (OCR). Respondé en el idioma del contenido; si es ambiguo, en español." ;;
    audio/*|video/*) PROMPT="Transcribí TODO el audio literalmente (sin resumir). Si es video, agregá al final una sección 'DESCRIPCIÓN VISUAL:' con los elementos visuales relevantes. Respondé en el idioma hablado; si es ambiguo, en español." ;;
    application/pdf) PROMPT="Extraé el texto completo del documento. Si tiene tablas o formularios, preservá la estructura. Respondé en el idioma del documento." ;;
    *) PROMPT="Extraé toda la información de texto de este archivo." ;;
  esac
fi

mkdir -p "$(dirname "$OUT")"
B64_SAFE_INLINE=20971520   # 20MB limite inline

build_body_inline() {
  jq -n --arg mime "$MIME" --arg data "$(base64 -w0 "$FILE")" --arg prompt "$PROMPT" \
    '{contents:[{parts:[{inline_data:{mime_type:$mime,data:$data}},{text:$prompt}]}],
      generationConfig:{temperature:0.2}}'
}

call_generate() { # $1=json body -> texto a stdout
  curl -s --max-time 600 "$API/v1beta/models/$MODEL:generateContent?key=$KEY" \
    -H "Content-Type: application/json" -d @- <<< "$1" | \
  jq -r '[.candidates[0].content.parts[]?.text] | join("")' 2>/dev/null
}

echo "[gemini] $FILE (${SIZE}B, $MIME) -> $OUT" >&2

if [ "$SIZE" -lt "$B64_SAFE_INLINE" ]; then
  BODY=$(build_body_inline)
  TEXT=$(call_generate "$BODY")
else
  # --- File API resumable upload ---
  DISPLAY_NAME=$(basename "$FILE" | tr -c 'A-Za-z0-9._-' '_' | cut -c1-100)
  START_RESP=$(curl -s -D /tmp/gemini-up-headers.$$ -o /tmp/gemini-up-body.$$ \
    -X POST "$API/upload/v1beta/files?key=$KEY" \
    -H "X-Goog-Upload-Protocol: resumable" \
    -H "X-Goog-Upload-Command: start" \
    -H "X-Goog-Upload-Header-Content-Length: $SIZE" \
    -H "X-Goog-Upload-Header-Content-Type: $MIME" \
    -H "Content-Type: application/json" \
    -d "{\"file\":{\"display_name\":\"$DISPLAY_NAME\"}}")
  UPLOAD_URL=$(grep -iE '^(location|x-goog-upload-url):' /tmp/gemini-up-headers.$$ | tr -d '\r' | tail -1 | awk '{print $2}')
  [ -z "$UPLOAD_URL" ] && { echo "ERROR upload start: $START_RESP" >&2; exit 1; }
  curl -s --max-time 1800 -X POST "$UPLOAD_URL" \
    -H "X-Goog-Upload-Offset: 0" \
    -H "X-Goog-Upload-Command: upload, finalize" \
    -H "Content-Type: $MIME" \
    --data-binary "@$FILE" > /tmp/gemini-up-final.$$
  FILE_URI=$(jq -r '.file.uri // empty' /tmp/gemini-up-final.$$)
  FILE_NAME=$(jq -r '.file.name // empty' /tmp/gemini-up-final.$$)
  [ -z "$FILE_URI" ] && { echo "ERROR upload: $(head -c 300 /tmp/gemini-up-final.$$)" >&2; exit 1; }
  # esperar ACTIVE
  for i in $(seq 1 60); do
    ST=$(curl -s "$API/v1beta/$FILE_NAME?key=$KEY" | jq -r '.state // "PROCESSING"')
    [ "$ST" = "ACTIVE" ] && break
    [ "$ST" = "FAILED" ] && { echo "ERROR file processing FAILED" >&2; exit 1; }
    sleep 5
  done
  BODY=$(jq -n --arg mime "$MIME" --arg uri "$FILE_URI" --arg prompt "$PROMPT" \
    '{contents:[{parts:[{file_data:{mime_type:$mime,file_uri:$uri}},{text:$prompt}]}],
      generationConfig:{temperature:0.2}}')
  TEXT=$(call_generate "$BODY")
  rm -f /tmp/gemini-up-*.$$
fi

if [ -n "$TEXT" ]; then
  echo "$TEXT" > "$OUT"
  echo "[gemini] OK -> $OUT" >&2
  exit 0
fi
echo "[gemini] FAIL (respuesta vacia o error de API)" >&2
exit 1
