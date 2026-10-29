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

## ADR-007 SQLite driver: `node:sqlite` (decided 2026-10-29)
Checked: Electron 45 bundles Node 24.22.1 with SQLite 3.53.4; `node:sqlite` works with no flags or warnings, in the app and
in Vitest (Node 24). Decision: use it. No new dependency and no native module to rebuild or ship.

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

## ADR-024 Voice through Ollama's OpenAI-compatible audio endpoints (2026-10-29)
Context: Chromium's speech recognition does not work in Electron (Google-backed). The goal is free and local.
Ollama 0.40 exposes `/v1/audio/transcriptions` and `/v1/audio/speech`, and the official `lfm3-audio` (2B) does both directions.
Decision: Use them through the same AI address, with the Windows voice (`speechSynthesis`) as the fallback. Any
OpenAI-compatible service (OpenAI, Groq for STT) works by changing the address. No speech code or model ships with the app.

## ADR-025 The character window ends SPEAKING when voice is on (2026-10-29)
Spoken audio outlasts the streamed text. Main suppresses the conversation's "done" while voice output is on; the character
window sends it after the last sentence. Any other way out of SPEAKING (Stop, new message, error) stops the audio.

## ADR-026 Push to talk only, recorded as 16 kHz WAV in the renderer (2026-10-29)
No background listening. The mic opens on click and closes on click, Esc or 60 s. The renderer downsamples and encodes WAV
(STT models expect it) and main forwards it. Shortcut: ScriptProcessorNode (deprecated) instead of an AudioWorklet.

## ADR-027 Procedural gestures, one at a time, over the state pose (2026-10-29)
Wave, nod, stretch, look-around and tilt are pure offset functions with a smooth envelope (tested to start and end at rest),
plus talking hands weighted by the SPEAKING state. They need no motion files, so there's no asset licensing.

## ADR-028 Lumi name, with `userData` pinned to the old folder (2026-10-29)
The product is called Lumi (user-renameable). Electron derives `userData` from `productName`, so renaming would have
silently "lost" everyone's chats and settings. `userData` is pinned to `%APPDATA%\Desktop Assistant`.

## ADR-029 Liquid glass = Windows acrylic + CSS layers, no library (2026-10-29)
Chat and settings use `backgroundMaterial: 'acrylic'` on frameless transparent windows (Windows 11 22621+), with CSS
tint, rim light and sheen on top and a custom title bar (native buttons look wrong on acrylic). No glass library: the
ones we looked at are web-only shaders or React wrappers around `backdrop-filter`, which this already is. Older Windows
gets an opaque fallback.

## ADR-030 One PermissionBroker; read runs, act asks (2026-10-29)
Every tool declares `risk: 'read' | 'act'`. Read tools run without asking, act tools wait for the user (once / this chat /
deny, 2 min → deny). Decisions live in main and reset on New chat. Tool results are wrapped as untrusted data. The model
never gets a shell, arguments for apps, or paths outside approved folders.

## ADR-031 MCP SDK bundled as a devDependency (2026-10-29)
`@modelcontextprotocol/sdk` is the reference client and handles stdio, Streamable HTTP and the protocol versions.
electron-vite bundles it into main, so it is a devDependency and `zod` stays the only runtime dependency (ADR-013).
Shortcut: SSE-only (legacy) servers are not supported; add if someone needs one.

## ADR-032 Web reading in a visible, isolated window (2026-10-29)
`web_read` loads public pages in a normal, visible BrowserWindow on its own `lumi-web` session partition (no shared
cookies, downloads blocked, private and local addresses refused, sandboxed) and extracts text. Visible on purpose: the
user sees what Lumi reads. Search uses DuckDuckGo's HTML page (no API key).

## ADR-033 Claude Code bridge: plan by default, fake CLI in tests (2026-10-29)
Tasks run the user's own `claude -p` with `stream-json` and an explicit permission mode (default `plan`), never bypass,
`shell: false`, only in approved folders. Hooks are optional, backed up, and token-authenticated. Tests swap the CLI
for `tests/fixtures/fake-claude.mjs` via env vars that packaged builds ignore, so no test needs a Claude login.

## ADR-035 Panels: non-transparent frameless Acrylic (2026-10-29)
A probe on this machine showed frameless + `transparent` Acrylic has square corners and no shadow, and a frameless
non-resizable window loses Acrylic entirely. Frameless, not transparent, resizable, `roundedCorners: true` keeps Acrylic
and gets Windows 11's rounded corners and shadow. Supersedes the fixed sizes in ADR-029.

## ADR-036 Bundled CC0 VRoid characters with matching voices (2026-10-29)
Four VRoid Studio sample models released by the VRoid Project under CC0 (mirrored at opengameart.org/content/vroid-studio-cc0-models;
each file's own VRM license also says redistribution, modification and commercial use allowed, credit unnecessary) ship
next to Seed-san. They add ~70 MB to the installer. Each character has a voice gender; choosing one sets lfm3-audio's
`male`/`female` voice. No anime voice model is bundled: candidates (Kokoro-82M via Kokoro-FastAPI, Apache-2.0, OpenAI-compatible
`/v1/audio/speech`) need a separate server, so they are a documented option rather than a dependency.

## ADR-037 Mirror X/Z bone rotations for VRM 0.x (2026-10-29)
VRM 0.x humanoids face -Z; after `VRMUtils.rotateVRM0` the same local rotations mirror. Procedural poses negate X and Z for
`metaVersion === '0'`, as three-vrm's own animation examples do.

## ADR-038 Hands-free voice mode with energy VAD, not a VAD model (2026-10-29)
Loudness against a tracked noise floor (with hysteresis and a 30 s cap) is enough for one speaker at a desk and needs no
model or dependency. The mic is open only while voice mode is on (Windows shows its mic indicator); audio is dropped while
Lumi thinks or speaks. Shortcut: no barge-in (interrupting her by talking); use Stop.

## ADR-039 web_open uses the user's browser; no general PC control (2026-10-29)
Opening sites and site searches goes through `shell.openExternal` with public https URLs only, after approval. Requests for
"full access to my PC" stay out of scope by design (SECURITY.md: no shell, no model-generated commands). Code changes go
through Claude Code tasks in approved folders; apps through the approved-apps list.

## ADR-034 Own Markdown subset instead of a Markdown library (2026-10-29)
Local models write paragraphs, lists, bold, inline code and fences. A 50-line parser renders exactly that as React text
nodes, so there is no HTML path to sanitize and no dependency. Links and images are intentionally not rendered.
