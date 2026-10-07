---
name: android-automation
version: "0.1.0"
description: Control an Android device via adb (Android Debug Bridge). Use when automating Android apps, tapping/swiping UI, reading the accessibility tree, taking screenshots, or driving a physical device or emulator over WiFi or USB. Do NOT use for iOS, desktop apps, or web automation (use browser-automation).
allowed-tools: Bash(adb:*) Bash(node:*)
metadata:
  author: galiprandi
  tags: [android-automation, adb, mobile, uiautomator, rpa, automation]
---

# Android Automation

Control a real Android device via `adb` from the terminal. Same operating model as `browser-automation`: the accessibility tree (`uiautomator dump`) plays the role of Playwright's snapshot, and taps/swipes play the role of clicks.

## Purpose

Operate a physical Android device or emulator: launch apps, navigate UI, tap, type, swipe, read the screen, take screenshots, and verify device state — over WiFi (preferred) or USB.

**Use for:** automating Android apps, UI testing on real devices, extracting on-screen data, filling forms in native apps, repetitive mobile workflows.

**Do NOT use for:** iOS devices (requires Appium/WebDriverAgent + macOS — not supported), desktop apps, or web pages (use `browser-automation` for those).

## Status

Early version: this skill currently covers **installation and device connection only**. UI interaction commands (tap, swipe, snapshot, screenshot) are planned — treat `uiautomator dump` + `input tap` as the manual fallback for now.

## Prerequisites

- `adb` (Android SDK Platform-Tools) — see [Setup](#setup)
- An Android device with **Developer Options** enabled:
  1. Settings → About phone → tap **Build number** 7 times
  2. Settings → System → Developer options → enable **USB debugging** (and **Wireless debugging** on Android 11+)

## Setup

### Linux

```bash
# Debian/Ubuntu
sudo apt install adb

# Fedora
sudo dnf install android-tools

# Arch
sudo pacman -S android-tools

# Or official Platform-Tools (always latest):
# https://developer.android.com/tools/releases/platform-tools
```

If the device is not detected over USB, add udev rules:

```bash
sudo apt install android-sdk-platform-tools-common   # ships udev rules
adb kill-server && adb start-server
```

### macOS

```bash
brew install --cask android-platform-tools
```

### Windows

1. Download Platform-Tools: https://developer.android.com/tools/releases/platform-tools
2. Extract to e.g. `C:\platform-tools` and add it to `PATH`
3. For USB: install the device OEM's USB driver (or Google USB Driver)
4. Verify: `adb version`

## Connecting (priority order)

**Goal: the phone must not stay tethered to the computer.** Always prefer wireless. USB is a bootstrap/fallback only.

### 1. `adb pair` — preferred (Android 11+, no USB ever needed)

Wireless debugging pairs over mDNS. The device shows a one-time pairing code.

On the phone: **Developer options → Wireless debugging → Pair device with pairing code**. It displays IP, port and a 6-digit code.

```bash
adb pair <ip>:<pair_port>        # enter the 6-digit code when prompted
# e.g. adb pair 192.168.1.50:37415
adb connect <ip>:<connect_port>  # NOTE: different port, shown on the Wireless
                                 # debugging main screen (not the pairing dialog)
adb devices                      # should list <ip>:<port>  device
```

Gotchas:
- The **pairing port ≠ connection port**. The pairing code dialog shows the pairing port; the connection port is on the Wireless debugging screen itself.
- Pairing credentials persist on the device — after the first pair, future sessions only need `adb connect <ip>:<port>` (as long as Wireless debugging stays enabled and the IP/port haven't changed; the connect port can rotate, check the screen if connect fails).
- Phone and computer must be on the same LAN. Some routers block mDNS/peer-to-peer (AP isolation) — if `adb pair` can't find the device, that's usually why.

### 2. `adb tcpip` + `connect` — WiFi fallback (needs USB once per boot)

If the device is on Android <11 or pairing fails: connect over USB once, switch adbd to TCP, then unplug.

```bash
# with USB connected:
adb devices                # confirm USB session works
adb tcpip 5555             # switch adbd to TCP mode
adb connect <phone_ip>:5555
# unplug USB — session stays alive
adb devices                # <phone_ip>:5555  device
```

Get the phone IP: `adb shell ip -f inet addr show wlan0` or Settings → Wi-Fi → network details.

Limitation: `tcpip` mode **does not survive a phone reboot** — you need USB again to re-enable it. `adb pair` (option 1) survives reboots as long as Wireless debugging is on.

### 3. USB — last resort

```bash
adb devices
# If "unauthorized": unlock the phone and accept the RSA fingerprint dialog
# If "no permissions" (Linux): fix udev rules, then adb kill-server && adb start-server
```

Use USB only when wireless is impossible (no shared LAN, AP isolation, Android <11 without a prior tcpip session).

### Verifying the connection

```bash
adb devices -l                        # must show "device", not "unauthorized"/"offline"
adb shell getprop ro.product.model    # sanity check the device responds
```

## Connection troubleshooting

- **`adb pair` fails / times out:** verify Wireless debugging is ON, both devices on the same LAN, router has no AP isolation. Try `adb mdns services` to confirm the device is discoverable.
- **`adb connect` refused after pairing:** the connect port rotated — check the port shown on the Wireless debugging screen, it changes when toggled or sometimes on network change.
- **Device shows `offline`:** `adb kill-server && adb start-server`, then reconnect. If wireless, re-run `adb connect`.
- **`unauthorized` over USB:** revoke USB debugging authorizations on the phone (Developer options), reconnect, accept the dialog.
- **Connection drops on WiFi:** the phone may have a changing DHCP lease — reserve a static IP for it in the router.
- **Phone rebooted, `connect` refused:** if paired (option 1) just re-run `adb connect` with the current port. If using `tcpip` (option 2), USB is required again.

## Navigation hierarchy (Android equivalent of KEYBOARD FIRST)

Browser-automation's Rule 0 maps to Android, but the ordering differs. Focus navigation is native (D-pad, Tab) but many touch-only apps implement it poorly. Preference order:

1. **System keyevents** — stable, universal: `KEYCODE_BACK`, `KEYCODE_HOME`, `KEYCODE_APP_SWITCH`, `KEYCODE_MENU`, `KEYCODE_TAB` (next form field), `KEYCODE_DPAD_*` (lists/menus), `KEYCODE_DPAD_CENTER`/`KEYCODE_ENTER` (activate focused element). Always try these before coordinates.
   ```bash
   adb shell input keyevent KEYCODE_TAB
   adb shell input keyevent KEYCODE_DPAD_DOWN
   adb shell input keyevent KEYCODE_DPAD_CENTER
   adb shell input keyevent KEYCODE_BACK
   ```
2. **Intents / deep links for navigation** — the Android analog of `goto <url>` (browser Rule 5). Stronger than web: you can jump straight to an internal activity without touching UI.
   ```bash
   adb shell am start -a android.intent.action.VIEW -d "https://..."
   adb shell am start -n <package>/<activity>
   ```
   Prefer this over tapping through app navigation whenever the target activity is known.
3. **Focused-field input** — `input text` and editing keyevents act on the focused `EditText` (verify `focused="true"` in `uiautomator dump` before typing):
   ```bash
   adb shell input text "hello world"        # types into focused field
   adb shell input keyevent KEYCODE_MOVE_HOME
   adb shell input keyevent KEYCODE_DEL
   ```
4. **Tap by bounds** — `uiautomator dump` → find node → tap its bounds center. The fallback when no keyevent/intent path exists (the analog of ref-based clicks):
   ```bash
   adb shell uiautomator dump /sdcard/ui.xml && adb pull /sdcard/ui.xml
   adb shell input tap <x> <y>
   ```

**Caveats vs web:** there is no universal search shortcut (`Ctrl+K`/`/`); app shortcuts like Gmail's `C` only work with physical keyboards if implemented; `Shift+Tab` is unreliable — navigate backwards with `DPAD_UP` or re-tab. Always verify focus/state via `uiautomator dump`, never assume.

## Roadmap

Planned next steps (mirroring `browser-automation`):

- `scripts/adb.js` wrapper: `devices`, `connect`, `snapshot` (parsed `uiautomator dump` with ephemeral `[ref=eXX]` → bounds), `tap <ref|x y>`, `type`, `swipe`, `key`, `screenshot`, `observe` (compact JSON of interactive elements)
- `references/keycodes.md` — common `KEYCODE_*` map
- `references/gestures.md` — swipe patterns, long-press, pinch
- App-specific guides (`apps/<package>/guide.md`) auto-injected like `sites/` in browser-automation
