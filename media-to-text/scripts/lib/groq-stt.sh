#!/bin/bash
# groq-stt.sh — transcripcion bulk de audio/video via Groq Whisper API.
# Uso: groq-stt.sh <input-file|url> <output.txt> [language]
# - Acepta archivo local o URL remota (ffmpeg streamea el audio, no guarda video)
# - Chunks de 15min mp3 16kHz mono (~5MB, bajo el limite free de 25MB)
# - Pacing por rate limit free (~7200 seg audio/hora, budget conservador 6000)
# - Cache de chunks por input -> reanudable si se corta
# Requiere: ffmpeg, ffprobe, curl, jq + lib/keys.sh (groq_key)
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
source "$HERE/keys.sh"

INPUT=${1:?uso: groq-stt.sh <input|url> <output.txt> [lang]}
OUT=${2:?falta output.txt}
LANG=${3:-es}
KEY=$(groq_key) || { m2t_need_key groq; exit 1; }
API=https://api.groq.com/openai/v1/audio/transcriptions
USAGE_LOG=${GROQ_ASH_LOG:-/tmp/groq-ash-usage.log}
ASH_BUDGET=${GROQ_ASH_BUDGET:-6000}
touch "$USAGE_LOG"

mkdir -p "$(dirname "$OUT")"

slug=$(echo "$INPUT" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g; s/-\+/-/g; s/^-//; s/-$//' | cut -c1-60)
cache="${MEDIA2TEXT_CACHE:-$HOME/.cache/media-to-text}/groq/$slug"
mkdir -p "$cache"

ash_used() { local now cutoff used=0; now=$(date +%s); cutoff=$((now-3600));
  while read -r ts sec; do [ "$ts" -ge "$cutoff" ] && used=$((used+sec)); done < "$USAGE_LOG"; echo "$used"; }
ash_wait() { local need=$1 used; while :; do used=$(ash_used)
  [ $((used+need)) -le "$ASH_BUDGET" ] && return 0
  echo "[groq] rate-limit: ${used}s/h usados, espero 60s" >&2; sleep 60; done; }
ash_record() { echo "$(date +%s) $1" >> "$USAGE_LOG"; }
chunk_dur() { ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$1" 2>/dev/null | cut -d. -f1; }

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
UA=""; case "$INPUT" in http://*|https://*) UA="-user_agent"; UA_ARG="Mozilla/5.0";; *) UA_ARG="";; esac
nice -n 19 ionice -c3 ffmpeg -y -v error $UA $UA_ARG -i "$INPUT" \
  -vn -ac 1 -ar 16000 -b:a 48k \
  -f segment -segment_time 900 -reset_timestamps 1 \
  "$tmp/chunk_%03d.mp3" < /dev/null 2>"$tmp/ffmpeg.err"
chunks=$(ls "$tmp"/chunk_*.mp3 2>/dev/null | wc -l)
[ "$chunks" -eq 0 ] && { echo "ERROR ffmpeg: $(tail -2 "$tmp/ffmpeg.err")" >&2; exit 1; }
echo "[groq] $chunks chunks para $INPUT" >&2

fail=0
for f in "$tmp"/chunk_*.mp3; do
  base=$(basename "$f" .mp3); cached="$cache/$base.txt"
  [ -s "$cached" ] && { echo "[groq] cache $base" >&2; continue; }
  dur=$(chunk_dur "$f"); dur=${dur:-900}
  ash_wait "$dur"
  ok=""
  for attempt in 1 2 3 4 5 6 7 8; do
    resp=$(curl -s --max-time 300 "$API" \
      -H "Authorization: Bearer $KEY" \
      -F "file=@$f" -F "model=whisper-large-v3-turbo" \
      -F "language=$LANG" -F "response_format=json" < /dev/null)
    if echo "$resp" | jq -e '.text' >/dev/null 2>&1; then
      ok=1; echo "$resp" | jq -r '.text' > "$cached"; ash_record "$dur"; break
    fi
    if echo "$resp" | grep -q "Rate limit"; then echo "[groq] rate-limit API (intento $attempt), espero 150s" >&2; sleep 150
    else echo "[groq] retry $attempt: $(echo "$resp" | head -c 200)" >&2; sleep 15; fi
  done
  [ -z "$ok" ] && { fail=1; echo "[groq] FAIL chunk $base" >&2; break; }
  echo "[groq] ok $base" >&2
done

if [ "$fail" -eq 0 ]; then
  cat "$cache"/chunk_*.txt > "$OUT" 2>/dev/null
  awk 'NF{print}' "$OUT" > "$OUT.tmp" && mv "$OUT.tmp" "$OUT"
  [ -s "$OUT" ] && { echo "[groq] OK -> $OUT" >&2; rm -rf "$cache"; exit 0; }
fi
echo "[groq] FAIL (cache en $cache)" >&2; exit 1
