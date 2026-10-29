# Lumi (Desktop Assistant)

A Windows desktop AI companion: an animated VRM character in a transparent, always-on-top window that talks by voice and
text, sees and operates your apps with your permission, helps with coding, and runs its AI locally (no Ollama needed) or
through an online provider you choose.

**Status:** see [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md) and [docs/UPGRADE_PROGRESS.md](docs/UPGRADE_PROGRESS.md)
(what is verified, and what is not).

## Use it (installed app)

1. Run `release\Lumi Setup 0.2.0.exe` (unsigned: SmartScreen → **More info → Run anyway**). It installs for your user
   only, at `%LOCALAPPDATA%\Programs\Lumi`, with Start-menu and desktop shortcuts.
2. Start **Lumi** from the Start menu. Settings → AI → **Lumi built-in** → **Download** Qwen3 4B (2.5 GB, once).
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

- **AI provider** (Settings → AI): Lumi built-in (Qwen3 on this PC, GPU when available), Ollama, Google Gemini, Groq,
  OpenAI, Anthropic, OpenRouter, or any OpenAI-compatible address. Paste a key under the provider; each service keeps its
  own key, encrypted by Windows (DPAPI) and never shown again; **Remove** deletes it.
- **Local models** (Settings → AI → Lumi built-in): download, switch, remove. Qwen3 4B needs ~3.5 GB of GPU memory
  (or ~5 GB RAM on CPU); Qwen3 1.7B is lighter.
- **Microphone and speech** (Settings → Voice): microphone, push-to-talk, Whisper or the AI service for speech-to-text,
  Windows or AI-service voice, optional "only respond when I say the name".
- **Hands-free voice:** tap the island at the top of the screen ("Tap here to talk"); tap again to stop.
- **Screen access and computer control** (Settings → Tools → plugins): turn the "Screen and desktop control" plugin off
  to disable it entirely. While it acts, the island turns red. **Emergency stop: Ctrl+Alt+Shift+X**, the tray menu, or
  tapping the red island. Every action asks first ("Allow for this chat" stops repeats). "Let cloud AI see screenshots"
  is off by default.
- **Projects** (Settings → Tools → folders): Lumi runs only the scripts in an approved project's `package.json`.
- **Character size:** scroll the mouse wheel over the character (or `+`/`−` with it focused). Drag it to move.

## Docs

[Architecture](docs/ARCHITECTURE.md) · [Security](docs/SECURITY.md) · [Decisions](docs/DECISIONS.md) ·
[Installation](docs/INSTALLATION.md) · [Roadmap](docs/ROADMAP.md) · [Plugin registry](docs/PLUGIN_REGISTRY.md) ·
[Development tools](docs/DEVELOPMENT_TOOLS.md)
