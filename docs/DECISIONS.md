# Decisions (ADR log)

Format: context → decision → consequences. Newest last.

## ADR-001 Electron over Tauri (2026-10-29)
Context: We need a transparent, click-through, always-on-top Windows window, Node-native MCP and Claude
tooling, and SQLite. AIRI and Xiaoke ship this on Electron. YUI uses Tauri.
Decision: Electron 45 + electron-vite.
Consequences: A larger install (~100 MB+) and higher idle memory. Mitigated by throttling render
when idle (Milestone 9).

## ADR-002 React instead of Vue (2026-10-29)
Context: AIRI and Xiaoke use Vue. The spec asks for React.
Decision: React 19 + TS. We borrow AIRI's patterns, not its components.

## ADR-003 No Python backend (2026-10-29)
Context: Xiaoke's Python stack exists for local GPU speech and memory models.
Decision: Single TypeScript codebase. Speech goes behind adapters (OS voices by default, cloud optional).
Revisit only for a concrete local-model requirement.

## ADR-004 Privileged work only in main; sandboxed renderers (2026-10-29)
Context: AIRI runs `sandbox:false`. Xiaoke runs sandboxed.
Decision: `sandbox:true` everywhere. Providers, storage, tools and secrets live in main, behind zod-validated IPC.

## ADR-005 OmniRoute not adopted (2026-10-29)
Context: A mandatory-to-evaluate dev tool. It is a multi-provider proxy that re-serves Claude subscription
OAuth to other tools and pools accounts.
Decision: Not installed. The app has its own provider interface. See `DEVELOPMENT_TOOLS.md` §B
for a compliant API-key-only variant, which needs your approval.

## ADR-006 Claude Code via hooks + headless CLI (2026-10-29)
Context: The docs offer hooks, `claude -p` (stream-json), and the Agent SDK. The Agent SDK expects API-key
auth for third-party products.
Decision: Status comes from hooks into a loopback ingress. Tasks run through the user's own `claude -p` in Manual
permission mode with prompts bridged to the app. Agent SDK + API key is an optional later adapter.

## ADR-007 SQLite driver (pending, Milestone 5)
Options: `node:sqlite` (no native build) vs better-sqlite3 13 (needs an Electron rebuild).
Decide after checking Electron 45's bundled Node for `node:sqlite` stability.

## ADR-008 Agent-skills subset instead of full plugin (2026-10-29)
Decision: 10 skills, project scope, per `DEVELOPMENT_TOOLS.md` §D. This saves always-on context and
avoids overlap with Ponytail and built-ins.

## ADR-009 Node 24 LTS for tooling (2026-10-29)
Node 26 became LTS the day before setup. Native prebuilds lag. Electron bundles its own Node regardless.

## ADR-010 Production pages over a custom `app://bundle` protocol (2026-10-29)
Context: `file://` pages get no response headers (so no CSP header) and have a broad, fuzzy origin.
Decision: Serve `out/renderer` via `protocol.handle('app')` with a path-containment check and a strict CSP
header. IPC trusts only `app://bundle` (plus the loopback Vite origin in unpackaged dev builds).

## ADR-011 Character geometry in content bounds (2026-10-29)
Context: At 125% scaling, `setPosition`/`setBounds` on the frameless window grew it ~1px per call
(measured +20px over 20 moves). `setContentBounds` held its size exactly over the same moves.
Decision: Create with `useContentSize: true`, and read/write/persist only content bounds for the character.

## ADR-012 Character drag via IPC, not `-webkit-app-region` (2026-10-29)
Context: CSS drag regions swallow mouse events, which breaks click vs drag detection, hit-testing and the context menu.
Decision: The renderer sends screen coordinates. Main moves the window from the drag-start origin.

## ADR-013 Only `zod` is a runtime dependency (2026-10-29)
React, three etc. are bundled into the renderer by Vite, so they are devDependencies. This shrank
the asar from ~1,660 to ~750 `node_modules` entries (7.5 MB).

## ADR-014 Seed-san as the bundled default model (2026-10-29)
Context: The app needs a character that works out of the box without a license risk.
Decision: Bundle Seed-san from the official VRM samples. Its embedded VRM-PL-1.0 terms allow redistribution
and commercial use with credit, so the credit is shown in Settings and `THIRD_PARTY_NOTICES.md`.

## ADR-015 Character state machine lives in main (2026-10-29)
Decision: The pure transition table is in `src/shared/character.ts`. Main holds the current state and the
transient timers and broadcasts the state in `AppState`. Chat and future voice/AI code send events, and the
character renderer only animates. This gives one source of truth and no per-window drift.

## ADR-016 Custom model bytes over IPC (2026-10-29)
Context: The renderer is sandboxed with `connect-src 'self'`, and the dev page is on a different origin than app://.
Decision: Main validates and copies the user's file, then returns its bytes over invoke to the character window
only. There is no new protocol route and no file paths in the renderer.

## ADR-017 Pixel-alpha hit testing (2026-10-29)
Decision: `readPixels` of one pixel from a `preserveDrawingBuffer` canvas, instead of raycasting skinned meshes.
It is exact to the drawn silhouette (hair, accessories) and costs one 1×1 GPU readback per mouse move.

## ADR-018 Procedural animation for now (2026-10-29)
Decision: Per-state poses blended in code, with no VRMA motion files, which avoids more asset licensing.
Revisit with licensed VRMA clips for richer motion in Milestone 9.

## ADR-019 Local-first AI: Ollama + qwen3:4b by default (2026-10-29)
Context: No budget. The PC has an RTX 4050 with 6 GB. Claude Pro has no API access.
Decision: Default to Ollama on 127.0.0.1 with `qwen3:4b` (fits in VRAM, tool-capable, Apache-2.0). Cloud endpoints are
opt-in with a visible privacy note. For a public release, users install Ollama and pull models themselves, so the
app never redistributes model weights.

## ADR-020 One OpenAI-compatible adapter first (2026-10-29)
Decision: Ollama, LM Studio, Groq, Gemini, OpenRouter and OpenAI all speak `/v1/chat/completions` + SSE, so one
adapter covers every free option. A native Anthropic adapter waits until someone has an API key to use it with.

## ADR-021 Conversation lives in main (2026-10-29)
Decision: One in-memory conversation in main, broadcast as snapshots + text deltas. The chat window and the island
render the same state, and it drives the character state machine. Per-turn tokens make "send while streaming" safe.

## ADR-022 API keys are bound to their origin (2026-10-29)
Decision: Changing the AI address to a different origin deletes the stored key, and model listing for an unsaved
address never sends the saved key. A key can therefore never leak to another service by editing the address.

## ADR-023 Keep qwen3's default reasoning and filter it (2026-10-29)
Measured: `reasoning_effort: "none"` → reasoning in the visible answer, 10 s. Default → clean answer, 1.2 s.
Decision: Send no reasoning options. Strip `<think>` and ignore reasoning fields.
