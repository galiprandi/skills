#!/bin/bash
# adb-connect.sh — discover and connect to any Android device advertising
# _adb-tls-connect._tcp (Wireless debugging, Android 11+) over the LAN.
#
# Works for any device/brand. No hardcoded IPs or models.
# Requires: adb (platform-tools), avahi-browse (Linux/avahi) — falls back
# to `adb mdns services` when avahi is unavailable.
#
# Usage:  adb-connect.sh [--all]
#   --all   connect to every discovered device instead of stopping at first
#
# Exit 0 if at least one device reached "device" state, 1 otherwise.

set -u
CONNECT_ALL=0
[ "${1:-}" = "--all" ] && CONNECT_ALL=1

LAST_FILE="${ADB_CONNECT_LAST:-$HOME/.adb-connect-last}"

discover() {
  # Emits "ip:port" lines, deduped. Sources in priority order:
  # 1. avahi-browse -rt (works on Debian where `adb mdns services` is broken)
  # 2. adb mdns services
  # 3. last-known endpoints file

  if command -v avahi-browse >/dev/null 2>&1; then
    timeout 6 avahi-browse -rt _adb-tls-connect._tcp 2>/dev/null \
      | awk '/address = \[/{ip=$3} /port = \[/{gsub(/[\[\]]/,"",$3); if(ip!=""){gsub(/[\[\]]/,"",ip); print ip":"$3; ip=""}}' \
      | sort -u
  fi

  if command -v adb >/dev/null 2>&1; then
    adb mdns services 2>/dev/null \
      | grep '_adb-tls-connect' \
      | grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+:[0-9]+' \
      | sort -u
  fi

  [ -f "$LAST_FILE" ] && cat "$LAST_FILE"
}

CANDS=$(discover | awk '!seen[$0]++')
[ -z "$CANDS" ] && { echo "adb-connect: no _adb-tls-connect service found on LAN" >&2; exit 1; }

OK=0
while IFS= read -r ep; do
  [ -z "$ep" ] && continue
  adb connect "$ep" >/dev/null 2>&1
  sleep 1
  if adb devices | grep "^$ep" | grep -q "device$"; then
    echo "$ep" >> "$LAST_FILE"; sort -u "$LAST_FILE" -o "$LAST_FILE"
    OK=1
    echo "connected: $ep"
    [ "$CONNECT_ALL" = "0" ] && break
  fi
done <<< "$CANDS"

[ "$OK" = "1" ] && exit 0

# Fallback: show device list anyway so caller sees partial states
adb devices | grep -v "List of"
echo "adb-connect: no device reached 'device' state" >&2
exit 1
