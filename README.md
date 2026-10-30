# Lumi (Desktop Assistant)

A Windows desktop AI companion: an animated VRM character in a transparent, always-on-top window that talks by voice and
text, sees and operates your apps with your permission, helps with coding, and runs its AI locally (no Ollama needed) or
through an online provider you choose.

**New here (person or AI agent)?** Read [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) first; AI agents taking over
should also read [OTHERAGENT.md](OTHERAGENT.md) (the whole history and the traps).

**Status:** see [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md) and [docs/UPGRADE_PROGRESS.md](docs/UPGRADE_PROGRESS.md)
(what is verified, and what is not).

## Use it (installed app)

1. Run `release\Lumi Setup 0.6.0.exe` (unsigned: SmartScreen → **More info → Run anyway**). It installs for your user
   only, at `%LOCALAPPDATA%\Programs\Lumi`, with Start-menu and desktop shortcuts.
2. Start **Lumi** from the Start menu. Settings → AI → **Lumi built-in** → **Download** Qwen3-VL 4B (2.9 GB, once).
   Settings → Voice → turn on voice input, choose **Lumi's Whisper** and download it (190 MB).
3. Your chats, settings and downloaded models live in `%APPDATA%\Desktop Assistant` and survive updates and uninstalling.

Only one copy of Lumi runs at a time. If a launch seems to do nothing, Lumi is already running: look for its tray icon.

## Develop

The project root is the folder with `package.json`: `C:\Users\Admin\Documents\Projects\Desktop Assistant`.
Requires Node 24 (`node --version`). Commands must run **in that folder**; from `C:\Users\Admin`, npm fails with
`ENOENT ... C:\Users\Admin\package.json`.

**CMD** (Win+R → `cmd`):

```bat
cd /d "C:\Users\Admin\Documents\Projects\Desktop Assistant"
dir package.json
npm install
npm run runtimes
npm run dev
```

**PowerShell** (use `npm.cmd`: Windows blocks the `npm.ps1` script by default):

```powershell
Set-Location "C:\Users\Admin\Documents\Projects\Desktop Assistant"
Test-Path .\package.json
npm.cmd install
npm.cmd run runtimes
npm.cmd run dev
```

`npm run runtimes` downloads the pinned llama.cpp and whisper.cpp engines (checksum-verified) into `resources\runtimes`
once. Stop the dev app with Ctrl+C in that terminal (or Quit from the tray icon).

| Command | What it does |
|---|---|
| `npm run dev` | Electron + renderer with hot reload |
| `npm run typecheck` · `npm run lint` · `npm test` | types, lint, unit tests |
| `npm run test:e2e` | builds, then Playwright tests on the real Electron app (never needs a real model) |
| `npm run build` | typecheck + production build into `out\` |
| `npm run package` | engines + build + NSIS installer → `release\Lumi Setup <version>.exe` |
| `npm run package:dir` | the same, unpacked: `release\win-unpacked\Lumi.exe` |

**Startup problems:** `ENOENT package.json` = wrong folder. `npm.ps1 cannot be loaded` = use `npm.cmd` (or run
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` yourself). App exits at once = another Lumi is running (the dev
terminal prints this). "Lumi's local AI engine is missing" = run `npm run runtimes`.
Logs: `%APPDATA%\Desktop Assistant\logs\lumi.log` (keys and tokens are masked).

## Configure

- **Settings** open inside the chat window (Settings button, tray, or the character's menu), with tabs on top.
- **AI provider** (Settings → AI): Lumi built-in (Qwen3 on this PC, GPU when available), Ollama, Google Gemini, Groq,
  OpenAI, Anthropic, OpenRouter, or any OpenAI-compatible address.
- **Online AI keys:** Settings → AI → click a provider (e.g. Google Gemini, which has a free tier) → in "Connect …" press
  **Get a key** (opens the provider's key page; sign in and create a key), copy it, paste it and press **Save key**.
  Lumi tests the connection at once; then pick a model. Each service keeps its own key, encrypted by Windows (DPAPI) and
  never shown again; **Remove** deletes it.
- **Local models** (Settings → AI → Lumi built-in): download, switch, remove. Qwen3-VL 4B Instruct (default: fast, can
  see screenshots) needs ~4.5 GB of GPU memory (or ~6 GB RAM on CPU); Qwen3 4B and 1.7B are alternatives.
- **Microphone and speech** (Settings → Voice): microphone, push-to-talk, Whisper or the AI service for speech-to-text,
  Windows or AI-service voice, optional "only respond when I say the name".
- **Hands-free voice:** tap the island at the top of the screen ("Tap to talk"); tap again to stop.
- **Keyboard shortcuts** (Settings → General): click the keys and press new ones; Reset restores the default.
- **Screen access and computer control** (Settings → Tools → plugins): turn the "Screen and desktop control" plugin off
  to disable it entirely. "Do what I ask without asking first" removes the approval cards. While it acts, the island's orb turns red. **Emergency stop: Ctrl+Alt+Shift+X**, the tray menu, or
  tapping the red island. Every action asks first ("Allow for this chat" stops repeats). "Let cloud AI see screenshots"
  is off by default.
- **Projects** (Settings → Tools → folders): Lumi runs only the scripts in an approved project's `package.json`.
- **Character size:** scroll the mouse wheel over the character (or `+`/`−` with it focused). Drag it to move.
- **Peek and sit:** drop her at the left or right screen edge and she peeks in; drop her feet on an app window's top
  edge (or drag her down onto the taskbar) and she sits on it, side-on, and rides along when you move the window (she
  hops down when it closes or minimises).
- **Menu:** right-click the character or the tray icon (Chat, Settings, Change character, Hide, Keep on top, Stop,
  Quit). **Island look** (Settings → General): Pill or Frosted glass; the AI model's name shows on the open island only
  if you turn on "Show the AI model on the island".
- **What the AI can do for you:** open any installed app or your folders ("open Brave", "open my Downloads"), play
  music or videos ("play a song"), click things in its own browser ("open the third video"), write notes and paragraphs
  (opened in Notepad), type and click in apps, send WhatsApp messages through WhatsApp Web (give it the number with country
  code; you must be logged in at web.whatsapp.com). With "Do what I ask without asking first" on, it acts without asking.
- **More characters:** 9 bundled (Settings → Character). For Miku, Teto and others: "Find Miku" / "Find Teto" open
  VRoid Hub; download a model whose terms allow it, then **Use my own .vrm file…**.

## Docs

[Architecture](docs/ARCHITECTURE.md) · [Security](docs/SECURITY.md) · [Decisions](docs/DECISIONS.md) ·
[Installation](docs/INSTALLATION.md) · [Roadmap](docs/ROADMAP.md) · [Plugin registry](docs/PLUGIN_REGISTRY.md) ·
[Development tools](docs/DEVELOPMENT_TOOLS.md)
