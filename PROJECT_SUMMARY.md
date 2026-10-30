# Lumi — project summary and handoff

**What it is:** Lumi is a Windows desktop AI companion. A 3D anime-style character (VRM) stands on your desktop, talks
by voice and text, and can operate your PC for you: open apps, type, click, browse and play videos, write files, run a
project's build/test scripts, and hand coding tasks to Claude Code. Its AI runs **on your own PC** (bundled llama.cpp +
Qwen models, no Ollama needed) or through an online provider you choose (Gemini, Groq, OpenAI, Anthropic, OpenRouter).

**Owner:** Anexeus (swarup). **Repo:** https://github.com/Anexeus/lumi-desktop-assistant (private).
**Stack:** Electron 45 · React 19 · TypeScript 6 (strict) · three.js + @pixiv/three-vrm · zod 4 · node:sqlite ·
Vite (electron-vite 6) · Vitest + Playwright · electron-builder (NSIS). Node 24.

This file is written so any developer or AI coding agent (Claude Code, Codex, Cursor, Copilot…) can pick the project up
cold. Read it, then `README.md` (exact commands), then `docs/CURRENT_STATE.md` / `docs/UPGRADE_PROGRESS.md`.
The full history of the conversation that built Lumi, the owner's preferences and the testing traps: `OTHERAGENT.md`.

---

## 1. How it is built (one screen)

```
src/main/         Electron main process: everything privileged
  index.ts        wiring: state, IPC handlers, windows, tray, shortcuts, tools, AI, voice
  windows.ts      character / island / chat windows (chat also shows Settings, with tabs)
  security.ts     sandbox, CSP, navigation blocking, crash reload, permissions
  settings.ts     settings (SQLite kv) + secrets (Windows DPAPI via safeStorage)
  storage/        node:sqlite store (chats, memories, kv); self-heals damaged indexes
  ai/             provider.ts (OpenAI-compatible streaming + tool calls), conversation.ts (tool loop),
                  local.ts (bundled llama-server / whisper-server + model downloads), voice.ts (STT/TTS)
  tools/          the AI's abilities, every action-type tool goes through broker.ts (approvals / auto-approve):
                  files, apps, notes/files_write, web (Lumi's browser + ad blocker), desktop (UI Automation),
                  projects (npm scripts), github, mcp
  claude/         Claude Code bridge (claude -p tasks, hooks)
  log.ts          %APPDATA%\Desktop Assistant\logs\lumi.log, secrets masked
src/preload/      the only bridge renderers get (window.assistant), typed
src/renderer/     sandboxed UI: character/ (three.js scene, VRM, gestures, speech), chat/ (chat + Settings view),
                  island/ (top bar, hands-free voice), settings/ (tabbed sections), ui/ (shared bits)
src/shared/       types, zod schemas for every IPC message, provider and model catalogs, characters
resources/scripts/desktop.ps1   bundled Windows helper: UI Automation, typing, keys, clicks, OCR (JSON over stdin)
resources/runtimes/             llama.cpp + whisper.cpp binaries (fetched by `npm run runtimes`, not in git)
scripts/fetch-runtimes.mjs      downloads + SHA-256-verifies those runtimes
tests/unit, tests/e2e           Vitest (≈150) and Playwright on the real Electron app (≈50)
```

**Data:** `%APPDATA%\Desktop Assistant\` — `assistant.db` (settings, chats, memories), `secrets.json` (DPAPI-encrypted
keys), `models\local\` (downloaded AI models), `logs\lumi.log`. Uninstalling keeps it.

**Key rules (see CLAUDE.md):** renderers are sandboxed and never see keys or the file system; every IPC payload and tool
input is zod-validated; there is no general shell — the AI can only use the specific tools listed above.

## 2. What the user gets

- **Character:** 10 bundled VRM characters (Hatsune Miku by RemiX3 is the default) with matching male/female voices; idle animations, waving,
  picked-up "wheee" reaction with hair/cloth physics; scroll the wheel over her to resize; drag to move; peeks in from
  a screen edge; sits on an app window's top edge and rides along; cute lines ("Yay!", "Hee hee!") and a cheer
  when an action worked.
- **Chat window** (click the character): chat, Tasks (Claude Code), **Settings** (same window, tabs: General, AI, Voice,
  Character, Tools, Integrations, Claude Code, Memory).
- **Island** (top of screen): taskbar-style blurred glass with a Siri-style orb; quick ask; tap for hands-free voice
  mode; the orb turns red while Lumi operates the PC; tap = stop. Global shortcuts are changeable in Settings.
- **AI:** built-in engine (llama.cpp, GPU via Vulkan with CPU fallback) with **Qwen3-VL 4B Instruct** (default: fast,
  follows instructions, can see screenshots) or Qwen3 4B / 1.7B; or Ollama; or cloud providers with per-provider keys.
- **Voice:** push-to-talk, hands-free mode with voice-activity detection, optional wake word ("Lumi"), Whisper on the PC
  or the provider's speech model; replies spoken with Windows voices or the provider's voice.
- **PC actions:** open apps (Notepad, Terminal, Explorer… always available), look at a window (UI Automation), click,
  type, press keys, scroll, browse in Lumi's own browser (with ad blocker) and play videos, write notes/files (backed
  up), download files, run a project's `package.json` scripts, open VS Code/terminal in a project, Claude Code tasks.
- **Control:** Settings → Tools → "Do what I ask without asking first" (no approval cards); emergency stop
  **Ctrl+Alt+Shift+X** / tray / tapping the red island; each plugin can be switched off.

## 3. History (what was done, in order)

| Commit | What |
|---|---|
| `88ba70b` M0–1 | Research, tooling (Ponytail, Graphify, agent-skills), Electron shell, transparent always-on-top character window, tray, secure IPC, tests |
| `4bdeefd` M2 | VRM character (Seed-san), animation state machine, click-through hit testing, drag/resize |
| `60e4209` M3 | OpenAI-compatible AI chat (Ollama default), encrypted keys, streaming, quick-ask island |
| `50201fc` M4–5 | Voice (Ollama lfm3-audio STT/TTS, Windows voice fallback), SQLite memory and history, gestures |
| `9e762b0` M6–9 | Permissioned tools (files, apps, web, notifications), MCP + GitHub, Claude Code bridge, liquid-glass UI, Lumi name, NSIS installer, hardening |
| `8343a79` | Hands-free voice mode, 4 extra CC0 characters with matching voices, web_open, rounded acrylic panels |
| `b9bc5e6` | Browser control, notes/file writing, downloads, drag physics, graphics quality, Ollama started hidden |
| `7de0f9b` 0.2.0 | Built-in llama.cpp/whisper.cpp (no Ollama), online providers, UI Automation desktop control, project scripts, emergency stop, wheel resize, logs |
| `60636a2` 0.2.1 | Fixes from testing the installed app: tool calls written as text, typing landing in Lumi, UTF-8 |
| `4c503d2` 0.3.0 | Qwen3-VL 4B default, no-approval mode, Settings inside the chat window with tabs, ad blocker, no console windows, DB self-repair, forgiving tool arguments, this summary |
| `2281387` 0.3.1 | Lumi icon everywhere, choose install location, settings logged at startup |
| `37918b4` 0.4.0 | Acrylic island + Siri orb, rebindable shortcuts, peeking and sitting on windows, cute lines, per-setting validation, OTHERAGENT.md |
| `fc615ee` 0.5.0 | Pill island (glass optional), Lumi's own menu, guided API keys, 4 more characters + Miku/Teto links, side-on sitting and taskbar seat, smoother wheel resize |
| `b9c8840` 0.6.0 | AI opens any app, plays videos, WhatsApp, acts without asking; island look for chat/settings; taskbar icon; rollback journal; front-facing sit |
| (next) 0.7.0 | Gemini fixed (voice, unreadable keys, gemini-3.6-flash), Miku default, dangling pick-up, knees-up taskbar sit, click to wave / double-click Settings, app_install, never asks, 64-bit installer check |

## 4. How to work on it

```bat
cd /d "C:\Users\Admin\Documents\Projects\Desktop Assistant"
npm install
npm run runtimes      & rem once: bundled AI engines
npm run dev           & rem PowerShell: npm.cmd run dev
npm run typecheck && npm run lint && npm test && npm run test:e2e
npm run package       & rem installer -> release\Lumi Setup <version>.exe
```

- Add an AI ability: a `tool({...})` in a plugin under `src/main/tools/` (zod input, `risk: 'read' | 'act'`), registered
  in `builtins` in `src/main/index.ts`. Act tools go through the broker automatically.
- Add a setting: type in `src/shared/ipc.ts`, zod in `src/shared/schemas.ts` (add `.default()` so old settings still
  load), default in `src/main/settings.ts`, handler in `index.ts`, preload method, UI in a `src/renderer/settings/*` tab.
- Add a model: an entry in `src/shared/localModels.ts` with URL, size and the publisher's SHA-256.
- E2E tests never need a real model (fake OpenAI-compatible server inside the tests). Never point tests at the user's
  real profile: they set `DESKTOP_ASSISTANT_USER_DATA` (ignored by packaged builds).
- Quit a running Lumi cleanly with `Lumi.exe --quit` (force-killing it mid-write once damaged its database indexes;
  the store now repairs that on startup).
- Decisions and their reasons: `docs/DECISIONS.md` (ADR-001…). Security model: `docs/SECURITY.md`.

## 5. Known limits (honest)

- A 4B local model is fast but not brilliant: long multi-step tasks can still go wrong; a cloud model (Gemini has a free
  tier) is smarter. Cloud providers were never tested with real keys.
- Windows OCR is broken on this PC's trimmed Windows build; the vision model covers "seeing" instead.
- Chromium/Electron apps (VS Code, Claude) expose few controls to UI Automation; screenshots + vision help there.
- No code signing (SmartScreen warns). Not tested on a second PC.
- Talking over Lumi to interrupt her isn't supported (use Stop / the emergency stop).
