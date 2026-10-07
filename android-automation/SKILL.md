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
- An Android device with **Developer Options** enabled — see [Enabling Developer Options](#enabling-developer-options)

## Enabling Developer Options

**Core principle: minimize user steps.** Everything that can be done or detected from the computer, do it yourself — OS-specific tooling, mDNS discovery, port rotation, model detection once connected (`getprop`). The user should only touch the phone for things that physically require it (enabling toggles, reading one-time codes). Fewer user steps = fewer failure points = more resilient connection.

**First: ask the user for the device brand and model** if they haven't said it, and whether they already see "Developer options" in Settings. The exact menu paths vary per OEM — do NOT recite the generic path if you know the specific one.

**Guide adaptively — one step at a time, adjusting to the user's situation.** Do NOT dump the full instruction list at once, and do NOT follow a fixed script. Ask one question / give one action, wait for the reply, then pick the next step based on what they report.

First, determine the starting state by asking (combine in ONE question when possible — e.g. "What brand/model is it, and do you see Developer options in Settings?"):

- **Brand and model** → decides the menu paths (see table below)
- **Is "Developer options" already visible in Settings?** → if yes, skip activation entirely
- **Android version** (ask or infer from model; Settings → About phone shows it) → Android <11 has no Wireless debugging → plan `tcpip`+USB instead of `pair`
- **Is the user on WiFi with the phone?** → no WiFi means wireless debugging can't work → fall back to USB
- **Is a USB cable/computer port available?** → affects which connection method is even possible

Then walk them through only the steps their situation needs, in order:

1. (skip if already done) Enable Developer Options: OEM-specific path to Build number → tap 7× (mention PIN prompt + toast)
2. Enable the needed toggles: Wireless debugging (Android 11+, on WiFi) and/or USB debugging
3. Handle OEM-specific blockers if they appear (see below)
4. Proceed to pairing/connection

Keep each message to a single action or question. If the user reports a problem mid-way, address only that problem before continuing. When a step has multiple actions, format them as a **numbered list, one action per line** — much easier to follow on the phone than prose.

**Do the connect-port lookup yourself.** After `adb pair` succeeds, don't ask the user for the connection port — discover it via mDNS, trying each of these in order (availability varies by OS):

1. `adb mdns services` — built-in, but unreliable in some packaged builds (e.g. Debian's lists nothing)
2. `avahi-browse -rt _adb-tls-connect._tcp` (Linux with avahi) — resolves name, IP, **port**
3. `dns-sd -B _adb-tls-connect._tcp` then `dns-sd -L <name> _adb-tls-connect._tcp` (macOS)
4. Windows: `adb mdns services` is usually the only option; if it fails, ask the user to read the port off the Wireless debugging screen (it differs from the pairing port)

Then `adb connect <ip>:<port>` and verify with `adb devices -l` + `adb shell getprop ro.product.model`.

**Resilience checklist — keep trying before asking the user:**
- `connect` refused → port rotated → re-run mDNS discovery (the port changes when Wireless debugging is toggled or the network changes)
- mDNS finds nothing → confirm both devices are on the same LAN; check router for AP isolation
- pairing expired → codes are single-use; ask the user to open the pairing dialog again for a fresh code
- Wired path always available as fallback: `adb tcpip 5555` + `adb connect <ip>:5555` over USB (needs USB once per boot)
- The pairing code dialog stays open while pairing — keep the user on that screen until `adb pair` returns

**After connecting, always close out the session:** send `adb shell input keyevent KEYCODE_HOME` so the phone returns to the launcher (leaving it mid-Settings is confusing), then tell the user the connection is ready and which device/model responded.

Universal flow (constant across brands): find **Build number** and tap it **7 times**; the device asks for PIN/pattern and confirms with a toast ("You are now a developer"). Then enable **USB debugging** and **Wireless debugging** (Android 11+) inside Developer options.

Per-OEM paths to the Build number entry:

| Brand | Path to Build number | Developer options location |
|---|---|---|
| Samsung (One UI) | Settings → About phone → **Software information** → Build number | Settings → Developer options (bottom of main Settings) |
| Google Pixel / stock Android | Settings → About phone → Build number | Settings → System → Developer options |
| Xiaomi / Redmi / POCO (MIUI, HyperOS) | Settings → About phone → **MIUI version** / OS version (tap 7×, not Build number) | Settings → Additional settings → Developer options |
| OnePlus (OxygenOS) | Settings → About phone → **Version** → Build number | Settings → System → Developer options |
| Motorola | Settings → About phone → Build number | Settings → System → Developer options |
| Huawei / Honor (EMUI/MagicOS) | Settings → About phone → Build number | Settings → System & updates → Developer options |
| Oppo / Realme (ColorOS) | Settings → About phone → Version → Build number | Settings → Additional settings → Developer options |
| Vivo (FuntouchOS) | Settings → More settings → About phone → **Software version** → Build number | Settings → More settings → Developer options |
| Sony (Xperia) | Settings → About phone → Build number | Settings → System → Developer options |

If the brand isn't listed or menus differ, tell the user to use the **Settings search bar** and search for "Build number" — it jumps straight to the right screen.

### OEM-specific blockers

Offer these only when the device needs them (i.e., when the toggle is missing, greyed out, or shows a blocked message):

- **Samsung — "Auto Blocker"** (One UI 6+): blocks USB debugging and Wireless debugging entirely; the wireless toggle shows "Blocked by Auto Blocker". Fix: Settings → **Security and privacy → Auto Blocker** → turn off. Note it also blocks sideloaded app installs; it can be re-enabled after the session but will block debugging again.
- **Samsung — Wireless debugging greyed without WiFi:** the toggle requires an active WiFi connection. Connect to WiFi first.
- **Xiaomi (MIUI/HyperOS):** USB debugging additionally requires a **Mi account signed in + SIM inserted**; there's a separate "USB debugging (Security settings)" toggle needed for granting permissions/input simulation.
- **Huawei:** may require disabling "Monitor ADB installation" or signing into a Huawei ID for some debug features.
- **Oppo/Vivo/Realme:** USB debugging sometimes auto-disables after a period or per-USB-port; re-toggle if `unauthorized` appears repeatedly.

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
