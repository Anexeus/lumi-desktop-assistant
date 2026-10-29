# Roadmap

Each milestone ends with: tests run (results recorded in `CURRENT_STATE.md`), docs updated,
`graphify update .`, and a review (`/code-review` or `/ponytail-review`).

| # | Milestone | Done when |
|---|---|---|
| 0 | Research and tooling | Tools installed/verified, research + architecture docs. **Done 2026-10-29** (OmniRoute pending decision, Context7 auth pending) |
| 1 | Desktop shell | Transparent always-on-top character window, chat + settings windows, tray, secure IPC skeleton, dev + production build verified, E2E smoke test. **Done 2026-10-29** (manual tray/shortcut/real-mouse check pending; see `CURRENT_STATE.md`) |
| 2 | Character | VRM loads (user-provided or verified-license sample), idle, blink, gaze, expressions, state machine with tests, drag/resize, click-through hit-test |
| 3 | AI conversation | Provider interface, Anthropic + OpenAI-compatible adapters, encrypted keys, streaming chat, cancel, timeouts, error states |
| 4 | Voice | Push-to-talk, mic selection, STT adapter, TTS (OS voices + cloud), interruption, lip sync |
| 5 | Memory | SQLite, settings persistence, explicit notes and memories, optional history, data viewer + delete |
| 6 | Tools | Plugin registry, PermissionBroker, fs search (approved roots, read-only), launcher allow-list, notifications |
| 7 | External integrations | MCP client (approved servers), docs search, browser automation (visible, on request), GitHub (least privilege) |
| 8 | Claude Code | Hook ingress + notifications, task runner (`claude -p` stream-json), progress, cancel, permission bridge |
| 9 | Release | Animation polish, idle-performance budget, error recovery, full test pass, NSIS installer, install/troubleshooting docs |

## Milestone 1 plan (implemented 2026-10-29; kept for reference)

1. `git init`, `.gitignore`, MIT-or-your-choice `LICENSE` (your call), `.nvmrc` (24).
2. Scaffold with electron-vite (React + TS template), then trim it: `src/main`, `src/preload`,
   `src/renderer/{character,chat,settings}`, `src/shared`.
3. Pin deps: electron 45, electron-vite 6, vite 8, react 19, typescript 6, zod 4, vitest 5,
   @playwright/test 1.64, eslint + typescript-eslint, electron-builder 26.
4. Main: WindowManager creating
   - character window: transparent, frameless, no shadow, always-on-top toggle, skipTaskbar,
     bounds persisted to a JSON file in `userData` (SQLite arrives in Milestone 5),
   - chat window and settings window (hidden until opened).
5. Security baseline: sandbox, contextIsolation, CSP, navigation/window-open blocking,
   permission handler, IPC sender validation, a zod-checked IPC contract in `src/shared`.
6. Tray: show/hide character, toggle always-on-top, open chat, open settings, quit.
   Global shortcut to show/hide. Single-instance lock.
7. Placeholder character: a lightweight three.js scene (procedural capsule/orb with idle bob) to
   prove transparency, dragging (`-webkit-app-region` on the body or a main-process drag via IPC),
   click-through with `setIgnoreMouseEvents(forward)`, and resize. VRM comes in Milestone 2.
8. Keyboard accessibility: tab order and focus rings in chat/settings, shortcuts listed in tray tooltip.
9. Tests: Vitest for IPC schemas and window-bounds logic. A Playwright `_electron` smoke test
   (app launches, three windows exist, character window is transparent and on top, tray toggles).
10. Verify `npm run dev`, `npm run build`, and an unpacked production build (`electron-builder --dir`).
11. Update `CURRENT_STATE.md`, run `graphify update .`.

Estimated new runtime deps: electron (dev), three, react, react-dom, zod. Dev: the build and test tools above.
