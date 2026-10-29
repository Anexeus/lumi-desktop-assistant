# Current State

_Last updated: 2026-10-29. Milestone 2 (character) implemented and verified. Milestone 1 is committed as `88ba70b`; Milestone 2 is not committed yet._

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

## Milestone 2: character (new)
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
| `npm test` (Vitest) | 33/33 pass: geometry, URL trust, bundle path traversal, CSP, IPC schemas, state machine (incl. 5,000 random events), VRM metadata validation |
| `npm run test:e2e` (Playwright `_electron`, production build) | 14/14 pass on 3 consecutive runs. Milestone 2 adds: VRM renders (opaque-pixel share), chat drives THINKING→SPEAKING→IDLE, NOTIFICATION times out, `timeout` from a renderer is rejected, only the character window can read model bytes, non-VRM import refused with a message, custom VRM import + reset (stubbed file dialog), console errors fail the suite. From Milestone 1: real pixel-alpha transparency, on-top, secure webPreferences, no Node in renderer, CSP blocks inline script, navigation + popups blocked, invalid IPC rejected, chat beside character, settings toggle persists, resize clamps, drag keeps size, hide/show, shortcut state, no uncaught page errors |
| `npm run dev` | windows load from the Vite dev server under the dev CSP; IPC works; chat sends; 0 console/page errors (checked over CDP) |
| `npm run package:dir` | `release/win-unpacked/Desktop Assistant.exe` (asar 7.5 MB); fuses confirmed with `@electron/fuses read`; exe boots, serves app:// pages with CSP, a traversal URL returns 404, no page errors |
| `npm audit --omit=dev` | 0 vulnerabilities |
| Idle cost (production build, 10 s sample after load) | renderer 0.27 % CPU, GPU process 0.3 %, main 0.01 %; working sets: renderer ~204 MB, GPU ~323 MB, main ~131 MB |
| Milestone 2 dev + packaged | Seed-san loads in `npm run dev` and in `release/win-unpacked` (asar 19 MB), with no console errors |

## Not verified (needs a person at the screen)
- How the character *looks* in motion (only still screenshots were reviewed) and whether the eyes track the cursor naturally.
- The real file dialog (E2E stubs it).
- Tray icon appearance and right-click menu.
- Pressing the global shortcut physically.
- Real mouse behavior: click-through over empty space, hover hit-test, drag and grip resize with a real mouse
  (the same code paths were only driven through the preload API in E2E).
- Mixed-DPI multi-monitor dragging (only a single 125% display was available).

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
