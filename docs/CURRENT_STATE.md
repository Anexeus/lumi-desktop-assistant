# Current State

_Last updated: 2026-10-29. Milestone 3 (AI conversation + island) implemented and verified; not committed yet. Milestones 1–2: `88ba70b`, `4bdeefd`._

## What exists
- Electron 45 + electron-vite 6 + React 19 + TypeScript app (`src/main`, `src/preload`, `src/renderer`, `src/shared`).
- **Character window:** transparent, frameless, no shadow, always-on-top (`'floating'`, toggleable), off the taskbar.
  Click-through outside the body via `setIgnoreMouseEvents(…, {forward:true})` + raycast hit test.
  Drag the body to move, drag the corner grip (or `+`/`−` with focus) to resize (clamped 160×200 to 900×1200).
  A click opens chat; right-click, Shift+F10 or the Menu key opens a menu. Position and size persist and
  recover onto the primary display if their monitor disappears.
  Placeholder character: a three.js orb with idle bob, breathing and blinking, capped at 30 fps (VRM comes in Milestone 2).
- **Chat window:** opens beside the character. Composer (Enter sends, Shift+Enter adds a new line). Replies are a fixed
  "no provider" notice until Milestone 3.
- **Settings window:** show/hide character, always-on-top, keyboard shortcut reference.
- **Tray:** click to show/hide. Menu: show/hide, always on top, chat, settings, quit.
- **Global shortcut** `Control+Alt+Shift+A` to show/hide (Settings shows a warning if another app has it).
- Single-instance lock. The app menu is removed.
- **Security baseline:** `app.enableSandbox()`; every window has `sandbox`, `contextIsolation` and no `nodeIntegration`.
  Production pages are served from `app://bundle` with a strict CSP header and path-containment checks.
  Navigation, popups and webviews are blocked. All permission requests are denied. Every IPC message is validated
  with zod plus a sender-origin check, and character-only channels also check the sender window. Packaged fuses:
  RunAsNode off, NODE_OPTIONS off, inspect args off, ASAR integrity on, app loads only from asar.

## Milestone 3: AI conversation + island (new)
- **Local AI by default:** Ollama 0.40.13 on this PC with `qwen3:4b` (2.5 GB, Apache-2.0, tool-capable). It runs 100% on the
  RTX 4050 (~3.2 GB of VRAM). Measured: the first reply after app start took 3.9 s (including model load), later replies 1.2–2.6 s.
- **One OpenAI-compatible adapter** (`src/main/ai/provider.ts`) covers Ollama, LM Studio, Groq, Gemini, OpenRouter, OpenAI etc.
  It supports streaming over SSE, cancellation, a first-token timeout (120 s) and an idle timeout (60 s), and readable errors
  (unreachable, bad key, model missing with an `ollama pull` hint, rate limit). It strips `<think>` reasoning, even when a
  tag is split across chunks.
- **One shared conversation in main** (`src/main/ai/conversation.ts`): the chat window and the island show the same messages.
  A system prompt is honest about missing features and includes the local date/time. History is the last 20 messages.
  A new message while a reply streams cancels the old one, and per-turn tokens prevent stale updates. It drives the
  character: THINKING, then SPEAKING on the first token, then IDLE, or ERROR on failure.
- **Chat window:** streamed replies, Stop (or Esc), Clear, a model badge ("on this PC" / "cloud"), error bubbles, and a
  "messages are sent to <host>" note for cloud endpoints. Replies are plain text: markdown rendering is not done yet.
- **Island:** an always-dark pill at the top centre of the primary display. Click it or press **Alt+Shift+Space** to expand
  it into a quick-ask panel (last exchange, input, Stop, "Open chat"). Esc or clicking another window folds it.
  It can be toggled in Settings. (`Ctrl+Alt+Space` was taken on this PC, so it was replaced.)
- **Settings → AI:** "Use Ollama on this PC", address, model (with suggestions), Test connection, Save, a privacy line
  (local vs. "messages will be sent to …"), and an API key field for cloud endpoints.
- **Secrets:** API keys are stored with `safeStorage` (Windows DPAPI) in `userData/secrets.json` and never returned to a
  renderer. The key is **deleted when the address changes to a different origin**, so it can't be sent to another service.
- Settings persist in `userData/settings.json` (zod-validated) until SQLite arrives in Milestone 5.

## Milestone 2: character
- **VRM character** via `@pixiv/three-vrm` 3.5.5. The default is **Seed-san** (VirtualCast, VRM Public License 1.0: redistribution
  and commercial use allowed, credit required; see `THIRD_PARTY_NOTICES.md`). It is bundled in `src/renderer/public/models/`.
- **Load your own .vrm** (Settings → Character model). Main validates the file (glTF magic, version, JSON chunk bounds,
  VRM 1.0 or 0.x metadata, ≤ 256 MB), copies it to `userData/models/custom.vrm` and sends the bytes over IPC to the
  character window only. "Use the default" deletes the copy. A custom model that fails to render falls back to the default.
- **State machine** (`src/shared/character.ts`): IDLE, LISTENING, THINKING, SPEAKING, WORKING, NOTIFICATION, ERROR.
  Main owns it, every window sees it through `AppState.character`, and invalid events are ignored. NOTIFICATION
  (4 s) and ERROR (3 s) time out on their own. Renderers cannot send `timeout`.
- **Animation:** one blended pose per state (head, neck, chest lean, hop, expression weights), so states crossfade
  instead of fighting. On top of that: random blinking, breathing and sway, gaze that follows the cursor anywhere
  on screen (main polls the cursor at ~15 Hz), an up-and-aside gaze while THINKING, and **placeholder** mouth
  movement while SPEAKING (random visemes; audio-driven lip sync is Milestone 4).
- **Hit testing** reads the alpha of the pixel under the cursor, so clicks pass through everywhere except the visible model.
- **Chat demo:** sending a message makes the character think, then "speak" the fixed reply, then return to idle.
- **Dev builds:** the character's right-click menu has "Preview state (dev)" to trigger each state by hand.

## Verified this session (commands actually run)
| Check | Result |
|---|---|
| `npm run typecheck` (node, web, e2e configs) | pass |
| `npm run lint` | pass |
| `npm test` (Vitest) | 51 pass + 2 opt-in skipped. Milestone 3 adds: SSE streaming (split lines), think-tag filter (split tags), HTTP error mapping, unreachable, cancel, first-token and idle timeouts, in-stream errors, model listing, conversation turns, cancel, replace-while-streaming, empty reply, clear. Earlier: 33 tests: geometry, URL trust, bundle path traversal, CSP, IPC schemas, state machine (incl. 5,000 random events), VRM metadata validation |
| `npm run test:e2e` (Playwright `_electron`, production build) | 20/20 pass on 2 consecutive runs (`ai.spec.ts` uses an in-test fake OpenAI-compatible server; `app.spec.ts` points at a closed port, so neither needs a real model). Milestone 3 adds: streamed reply with hidden reasoning + character states, island placement/expand/answer/shared conversation/Esc/blur-collapse/shortcut state, Stop keeps partial text, Test connection lists models, API key encrypted at rest + sent as Bearer + dropped on origin change, unsafe URLs and empty messages rejected, unreachable AI shows an error + ERROR state. Milestone 2: 14 tests, Milestone 2 adds: VRM renders (opaque-pixel share), chat drives THINKING→SPEAKING→IDLE, NOTIFICATION times out, `timeout` from a renderer is rejected, only the character window can read model bytes, non-VRM import refused with a message, custom VRM import + reset (stubbed file dialog), console errors fail the suite. From Milestone 1: real pixel-alpha transparency, on-top, secure webPreferences, no Node in renderer, CSP blocks inline script, navigation + popups blocked, invalid IPC rejected, chat beside character, settings toggle persists, resize clamps, drag keeps size, hide/show, shortcut state, no uncaught page errors |
| `npm run dev` | windows load from the Vite dev server under the dev CSP; IPC works; chat sends; 0 console/page errors (checked over CDP) |
| `npm run package:dir` | `release/win-unpacked/Desktop Assistant.exe` (asar 7.5 MB); fuses confirmed with `@electron/fuses read`; exe boots, serves app:// pages with CSP, a traversal URL returns 404, no page errors |
| `npm audit --omit=dev` | 0 vulnerabilities |
| Live Ollama (`OLLAMA_TEST=1 npx vitest run tests/unit/ollama.integration.test.ts`) | 2/2 pass: lists `qwen3:4b`; streams "Hello! 2 + 2 equals 4." (first token 2.6 s, ~61 chunks/s), no reasoning leaked |
| Live app, production build + real Ollama | island question answered (first text 3.9 s incl. model load); packaged `release/win-unpacked` answered "ready" in 2.6 s; Settings → Test connection: "Connected. 1 model available."; no console errors |
| Idle cost (production build, 10 s sample after load) | renderer 0.27 % CPU, GPU process 0.3 %, main 0.01 %; working sets: renderer ~204 MB, GPU ~323 MB, main ~131 MB |
| Milestone 2 dev + packaged | Seed-san loads in `npm run dev` and in `release/win-unpacked` (asar 19 MB), with no console errors |

## Not verified (needs a person at the screen)
- Pressing Alt+Shift+Space physically, and how the island feels over full-screen apps.
- A real cloud provider (only the fake server and local Ollama were used; no cloud key was entered).
- How the character *looks* in motion (only still screenshots were reviewed) and whether the eyes track the cursor naturally.
- The real file dialog (E2E stubs it).
- Tray icon appearance and right-click menu.
- Pressing the global shortcut physically.
- Real mouse behavior: click-through over empty space, hover hit-test, drag and grip resize with a real mouse
  (the same code paths were only driven through the preload API in E2E).
- Mixed-DPI multi-monitor dragging (only a single 125% display was available).

## Findings while testing (Milestone 3)
- `reasoning_effort: "none"` on Ollama makes qwen3 *worse*: reasoning leaks into the answer and the reply takes 10 s instead of 1.2 s.
  The app keeps the default and filters the hidden reasoning instead.
- `Ctrl+Alt+Space` is taken on this PC, so the island shortcut is now `Alt+Shift+Space`.
- The model claimed it could tell the time, so the system prompt now includes the local date/time.
- Test-harness: after a failure Playwright relaunches the app, so tests must not rely on windows earlier tests opened.

## Bugs found and fixed while testing (Milestone 2)
- The CSP blocked GLTFLoader's `fetch()` of the `blob:` URLs it makes for embedded textures. `connect-src` now allows
  `blob:`, and E2E now fails on console errors (it only caught uncaught exceptions before).
- The model was reported as loaded before its first frame was drawn. Shaders are now compiled with `compileAsync`
  and one frame is rendered before `setModel` resolves.
- Expressions were too subtle to read at full-body size. Head and posture amplitudes were roughly doubled.
- Test-harness issues: Playwright waits forever on a navigation the app blocked, so that check now runs last.
  Controlled checkboxes need click-and-assert instead of `check()`.

## Bugs found and fixed while testing (Milestone 1)
- Chat crashed after the first message: newer Chromium returns a Promise from `scrollIntoView`, and a concise
  arrow `useEffect` returned it as the "cleanup" (`destroy_ is not a function`). Fixed with a block body.
- At 125% scaling, `setPosition` grew the window ~1px per call (drag drift). The character now uses content
  bounds everywhere (`useContentSize`, `get/setContentBounds`), which a probe showed to be stable over 20 moves.
- `THREE.Clock` is deprecated in three 0.186. Replaced with `THREE.Timer`.

## Known issues / follow-ups
- A packaged exe still honors `--remote-debugging-port` (a Chromium switch, not covered by fuses). Address in Milestone 9.
- Renderer bundles are unminified (electron-vite default). Consider for the Milestone 9 performance pass.
- No app icon yet (default Electron icon). No code signing.
- `window-state.json` is a stopgap until SQLite (Milestone 5).

## Pending from Milestone 0
- Context7 needs authentication (`/mcp`). OmniRoute is intentionally not installed.
- Restart the Claude desktop app so Claude Code sees the new PATH (node, graphify).
