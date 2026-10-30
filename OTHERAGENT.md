# OTHERAGENT.md — the whole story of Lumi, for the next AI

You are picking up **Lumi**, a Windows 3D AI desktop companion, from another AI agent (Claude Code). This file tells you
everything that happened in the long chat that built it: what the owner asked for, what was built, what broke and how
it was fixed, what was decided and why, how to test, and what is still open. Read it once end to end.

Then read, in this order: [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) (architecture, one screen), [README.md](README.md)
(exact commands), [CLAUDE.md](CLAUDE.md) (working rules and security invariants: they bind every agent), and
[docs/UPGRADE_PROGRESS.md](docs/UPGRADE_PROGRESS.md) (test results per release). Decisions: [docs/DECISIONS.md](docs/DECISIONS.md).

---

## 1. The project in one paragraph

An anime-style VRM character stands on the Windows desktop in a transparent, always-on-top, click-through window. You
talk to her by voice or text (chat window, or the "island" bar at the top of the screen). Her AI runs on your PC
(bundled llama.cpp with Qwen3-VL 4B on the GPU, Whisper for speech) or through an online provider with your own key. She
can operate the PC through specific, validated tools: open apps, read windows with UI Automation, click, type, press
keys, browse and play videos in her own ad-blocked browser, write notes and code files in approved folders, run a
project's npm scripts, and hand coding tasks to Claude Code. Electron 45 + React 19 + TypeScript 6 strict + three.js /
three-vrm + zod 4 + node:sqlite. Repo: https://github.com/Anexeus/lumi-desktop-assistant (private, owner Anexeus).

**Version now:** 0.4.0 (this round). Previous releases: 0.2.0, 0.2.1, 0.3.0, 0.3.1 (only the latest release is kept on
GitHub; older ones were deleted at the owner's request).

## 2. The owner and how to work with them

- **Anexeus.** Casual, fast-typing English, many typos, sends screenshots of problems. Not a programmer by habit:
  explain in plain words, give exact commands (they use PowerShell; `npm.cmd`, not `npm`).
- **They want it to just work, fast.** Hated: slowness, console windows popping up, approval cards ("i dont wanna allow
  once… its my model so do what i say"), having to start Ollama, settings in separate windows.
- **They like:** cute character behaviour (voices, "Wheee!", "Yay!"), Apple/Windows-11 style glass UI, real blur, the
  violet orb icon, everything on GitHub with an installer release.
- **Standing instruction:** "if something in cmd or terminal keeps stucking or freezes, re-run it and fix everything."
  Use timeouts on every command and re-run anything that hangs.
- **Releases:** after a round of fixes they usually want: build the NSIS installer, test it, push, publish a GitHub
  release, delete older installers. Ask before pushing if they didn't say so in that message.
- **Authorizations they gave:** an opt-in "Do what I ask without asking first" mode (ADR-048) — on for them. What was
  NOT given and must stay: a general shell for the AI (CLAUDE.md invariant; they were told why), bypassing Claude Code
  permissions, reading credentials.

## 3. Their machine and the environment

| Thing | Value |
|---|---|
| PC | i7-13700HX, 16 GB RAM, RTX 4050 Laptop 6 GB + Intel UHD 770, display 1920×1200 at **125 %** (DIP work area 1536×912) |
| Windows | 11 Pro 22621, a debloated build ("Aspect 11X / NanoWin"): **Windows OCR fails (E_FAIL)**, Calculator not installed, dark mode |
| Project | `C:\Users\Admin\Documents\Projects\Desktop Assistant` |
| Node | `C:\Users\Admin\AppData\Local\Programs\node-v24.22.2-win-x64` (prefix PATH in Git Bash) |
| gh | `C:\Users\Admin\AppData\Local\Programs\gh\bin\gh.exe`, logged in as Anexeus, `gh auth setup-git` done |
| graphify | `~/.local/bin/graphify`; after code changes run `GRAPHIFY_BACKEND=none graphify update .` |
| Installed app | `%LOCALAPPDATA%\Programs\Lumi\Lumi.exe` (per-user NSIS install, location selectable) |
| User data | `%APPDATA%\Desktop Assistant\`: `assistant.db`, `secrets.json` (DPAPI), `models\local\` (Qwen3-VL 4B + mmproj, Qwen3 4B, Whisper small.en), `logs\lumi.log` |
| Their settings | AI `builtin` + `qwen3-vl-4b`, speech-to-text `builtin` (Whisper), auto-approve on, voice output `local` (falls back to the Windows voice: the built-in engine has no TTS), graphics high, character `shibu` |

Never point tests at the real profile: dev/E2E runs set `DESKTOP_ASSISTANT_USER_DATA` (packaged builds ignore it). Back up
`assistant.db` before touching it, and only while Lumi is not running (`Lumi.exe --quit` quits cleanly).

## 4. The story, in order

### 4.1 The original brief (milestones 0–9)
A 3D AI desktop assistant with chat, voice, memory (SQLite), a plugin registry with permissions, MCP, a Claude Code bridge
(hooks + `claude -p` only), security hardening, docs, and an installer. Hard rules from that brief, still in force: no
unrestricted shell; never bypass auth, limits or permission prompts; never automate claude.ai or extract credentials;
back up and explain before changing `~/.claude` settings; ask before destructive or credentialed operations.
Built milestone by milestone (M0 tooling and Electron shell → M2 VRM character → M3 AI chat → M4–5 voice and memory →
M6–9 tools, MCP, GitHub, Claude Code, glass UI, installer, hardening). See the history table in PROJECT_SUMMARY.md.

### 4.2 Polish round (after M9)
Owner asked for: rounded corners; the wave animation fixed (the hand stayed at 90°: the forearm twist was applied in the
wrong frame, fixed with a ZYX twist split between forearm and wrist); more 3D models (4 CC0/licensed characters added,
each with a male or female voice); cute voices; blurrier glass; hands-free voice by tapping the island; "open YouTube…"
style commands; a GitHub repo (created private, pushed with gh device login).

### 4.3 "Ollama shouldn't have to be open", natural pose, drag reactions, physics, graphics setting
Ollama started hidden at first; arms rest naturally (not T/A-pose); picked up = arms up, legs kick, "Wheee!", body lags
behind the window with damped-spring inertia so hair and cloth (VRM spring bones) swing; a Low/Balanced/High graphics
setting; light-background bug in Settings fixed; "Tap here to talk" on the island when voice is off.

### 4.4 Model clipping, dead click zone, cmd ENOENT
The model was cut off while waving (camera framing got headroom); a transparent margin blocked clicks (pixel-alpha hit
testing: the window ignores the mouse except over painted pixels); `npm` run from the wrong folder (README explains).

### 4.5 The 14-phase "complete repair" brief → 0.2.0
Built-in AI with no Ollama (llama.cpp b11982 Vulkan + whisper.cpp b5454, pinned and SHA-256-checked by
`npm run runtimes`, random port + per-launch API key, dedicated GPU picked over the iGPU); online providers (Gemini, Groq,
OpenAI, Anthropic, OpenRouter, custom) with one DPAPI-encrypted key each; desktop control through a bundled PowerShell
helper (`resources/scripts/desktop.ps1`: UI Automation, SendInput, screenshots; JSON requests, never code); project
scripts (only `package.json` scripts of approved folders, no shell); emergency stop (Ctrl+Alt+Shift+X, tray, red island);
mouse-wheel resize; a redacting diagnostic log; installer. 0.2.1 fixed what testing the installed app found (tool calls
written as plain text by the model → parsed; typing landing in Lumi's own chat → helper targets the topmost non-Lumi
window; non-ASCII typing → UTF-8 stdin).

### 4.6 "Too many bugs, too slow, keeps opening cmd" → 0.3.0
Console windows: Ollama was spawned detached so each child got a console → attached now. Slowness: Qwen3-VL 4B Instruct
made the default (thinking off, 16k context, 8-bit KV cache, Qwen sampling): ~1.5–4 s replies, ~5–11 s for desktop tasks.
No approval cards: opt-in auto-approve (ADR-048). Settings moved into the chat window with tabs. Ad blocker (Ghostery
engine, bundled devDependency) on Lumi's browser. Damaged SQLite indexes ("database disk image is malformed") → REINDEX
self-heal at startup. Forgiving tool arguments. PROJECT_SUMMARY.md and AGENTS.md written. Old installers deleted.

### 4.7 Icon and install location → 0.3.1
The violet orb-with-eyes icon everywhere (exe, installer, tray, every window, title bars, notifications; `build/make-icon.py`).
The installer lets the user choose the install folder. Released as v0.3.1.

### 4.8 This round → 0.4.0
The owner's message: fix all bugs/UI/model issues; make the characters say "Yay!" or something cute; remove the island's
colours and make it blurry like the Windows taskbar; make the green dot look like the Siri orb; let them change key
bindings in Settings; write this file; make the characters peek from the left/right screen edge and sit on top of open
app windows. What was done:

- **Island = taskbar glass.** The island window now uses the OS Acrylic material (real desktop blur, the same as the
  taskbar) with a neutral dark tint and no colours. Probed first: CSS `backdrop-filter` cannot blur the desktop, and
  Windows ignores `setShape` (a pill-shaped region) on Acrylic windows, so the island has Windows 11's own rounded
  corners and shadow, not a full pill (ADR-052). Older Windows gets a transparent window with an opaque tint.
- **Siri-style orb** replaces the green dot: three colour blobs swirling in a glass sphere, pops in with an overshoot
  when it appears or voice mode toggles, spins faster while thinking, swells with the mic level, turns red while Lumi
  controls the PC (the island is still the emergency stop then).
- **Editable global shortcuts** (Settings → General → Keyboard): click the keys, press a new combination, Esc cancels,
  Reset restores the default. Needs Ctrl, Alt or Win (Shift alone would swallow typing everywhere); a combination
  another app or another Lumi shortcut owns is refused and the old keys keep working. `src/shared/shortcuts.ts`,
  `Invoke.setShortcut`, `AppState.shortcuts` (replaced `shortcut`/`islandShortcut`/`stopShortcut`). ADR-053.
- **Cute lines:** tap her → "Hi hi!" / "Yay!" / "Hee hee!"; a new character picked → cheer + "Yay!"; something she did
  for you worked (a tool item with `ok: true`) → cheer gesture (arms up, two hops) + "Yay!" once per request; sits →
  "Hee hee!"; peeks → "Peekaboo!"; falls → "Whoa!". Exclamations use a higher pitch and quicker rate (Windows voice) or
  1.15× playback (AI voice), are rate-limited, and **now fall back to the Windows voice** — before, with the built-in
  engine (no TTS) they were silently dropped, so the owner never heard "Wheee!".
- **Peeking:** dropped with her centre near an outer left/right screen edge (no second monitor beyond it), she slides
  half past the edge and leans in from behind it (hips, spine, chest ~37°), turned to the screen, head tilted, smiling.
- **Sitting on windows:** dropped with a window's top edge between her hips and feet (and that edge not hidden by a
  window above), she sits on it — hips on the edge, thighs forward, feet swinging over the front — follows the window
  when it moves (polls 300 ms, 30 ms while it moves), and falls to the bottom of the screen ("Whoa!") when it is
  minimised, closed, maximised or moved too high. Window positions come from two new read-only helper ops, `frames`
  and `frame` (compiled C#, 8–17 ms). Pure placement maths in `src/main/geometry.ts` (`peekPlacement`, `seatPlacement`).
  ADR-054.
- **Bugs fixed:**
  - *Settings reset to defaults* (the "settings reverted to Ollama" mystery): the whole saved settings object was
    validated at once, so one invalid or unknown field (e.g. written by another Lumi version) threw away **all**
    settings. Now each setting is validated on its own (`parseSettingsFile`), and only a bad one is reset (logged).
  - *Character grew a few pixels on every launch* at 125 % scaling (created 303 px wide for 300, and the size was
    saved): the exact content bounds are set again right after creating the window.
  - *Lopsided models framed off-centre* (Seed-san's prop arm widened the bounding box, so his body stood off the window
    centre): the camera centres on the hips; width fits the wider side.
  - *A failing AI voice was retried for every sentence* (built-in engine has no TTS): after one failure Lumi uses the
    Windows voice until the voice/AI settings change.
  - The database damage seen earlier was most likely caused by test procedures (copying/restoring `assistant.db` while
    Lumi ran, leaving a stale `-wal`); the store closes cleanly on quit and repairs damaged indexes at startup.

## 5. Decisions worth knowing (see docs/DECISIONS.md)

- Main owns all state (`AppState`) and broadcasts it; renderers are sandboxed and only use `window.assistant`.
- Character geometry uses **content bounds** only (window bounds drift on scaled displays).
- Glass: panels and island are frameless, non-transparent windows with `backgroundMaterial: 'acrylic'` (a transparent
  Acrylic window loses rounded corners; a custom shape is ignored).
- Built-in AI over Ollama: no extra install, no console windows, GPU picked explicitly (ADR-040s).
- Auto-approve is opt-in and per user; the emergency stop, red island and plugin switches still apply (ADR-048).
- No general shell, ever: add specific tools instead (ADR-040, ADR-045). Explained to the owner.
- Exactly one runtime dependency: `zod`. Renderer/bundled libraries are devDependencies.
- Bundled characters are CC0 or licensed for redistribution; YUI (PolyForm-NC) and Lala (AGPL): ideas only, never code.

## 6. How to test (and the traps)

```bash
npm run typecheck && npm run lint && npm test && npm run test:e2e   # all must pass before claiming anything works
```

- **Unit:** Vitest, ~165 tests. Pure renderer helpers imported by tests must be listed in `tsconfig.node.json`.
- **E2E:** Playwright `_electron` on the built `out/`, isolated profile, fake OpenAI server inside the tests (never a real
  model), fake Claude CLI via `DESKTOP_ASSISTANT_FAKE_CLAUDE*` env vars. ~51 tests. One voice test is occasionally flaky.
- **Seeing the real desktop** (blur, peeking, sitting): Playwright page screenshots don't include OS effects. Launch the
  built app with Playwright and call `desktopCapturer.getSources({ types: ['screen'] })` through `app.evaluate`, then
  crop. Put a plain backdrop window (Lumi's own, so the helper ignores it) behind the area so the owner's private
  windows aren't captured.
- **A stand-in app window** must live in a different process (the helper skips Lumi's PID). Electron's main process
  **cannot read stdin on Windows**, so drive such a window with timers, and give it its own `userData` — a leftover copy
  otherwise holds Electron's single-instance lock and the next run silently exits. Kill leftovers by checking command
  lines first (never kill the owner's own apps).
- **The packaged app** refuses debug switches, so Playwright can't drive it. Drive it with the desktop helper (Python
  sending JSON lines; launch with `--force-renderer-accessibility` so UIA sees web content; timings ~10× slower).
- Write multi-line Python/PowerShell scripts to files and run them; inline heredocs get mangled. `python -I`.
- Git Bash's GNU tar misreads `C:` paths: use `C:\Windows\System32\tar.exe`. robocopy exit codes 1–7 mean success.
- Playwright forces a light colour scheme: `emulateMedia({ colorScheme: 'dark' })` when checking dark UI.

## 7. Releasing

```bash
npm version 0.4.0 --no-git-tag-version      # or edit package.json
npm run package                              # runtimes + build + NSIS → release\Lumi Setup <v>.exe
```
Test the installer (install, launch, a desktop task, uninstall keeps user data). Copy to `release\Lumi-Setup-<v>.exe`,
commit, push, then `gh release create v<v> "release\Lumi-Setup-<v>.exe" --title "Lumi <v>" --notes "…"` and delete
older releases if the owner wants only the latest. Record results in `docs/UPGRADE_PROGRESS.md`.

## 8. Known issues and open items

- 4B local model: fast, but long multi-step desktop tasks can still go wrong; a cloud model is smarter. Cloud providers
  were never tested with real keys.
- Windows OCR is broken on this PC's Windows build (environment, not code); the vision model covers "seeing".
- Electron/Chromium apps (VS Code, Claude, Discord) expose few UI Automation controls; screenshots + vision help.
- The installer is unsigned (SmartScreen: More info → Run anyway). Never tested on a second PC.
- No barge-in (talking over her to interrupt); use Stop or the emergency stop.
- The island cannot be a true pill with real blur on Windows (see 4.8); it is a rounded Acrylic bar.
- Sitting needs the desktop helper (PowerShell, ~2 s to start the first time; it is warmed when you pick her up).
  Windows above the seat window are not re-checked after she sits (she stays on her window).
- Shortcut recording uses physical key positions (US names); on AZERTY-like layouts a letter can differ from its label.

## 9. Ideas the owner may ask for next

More characters (only CC0/redistributable VRMs), a cloud-model test with a free Gemini key, barge-in, signing the
installer, letting her walk along the taskbar, a mini "follow the cursor" mode.
