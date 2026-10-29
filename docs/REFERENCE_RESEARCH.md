# Reference Research

Researched 2026-10-29. Method: GitHub API metadata for all ten projects. For AIRI, Xiaoke AI
and YUI, tree-only (`--filter=blob:none`) clones, reading specific files. No code or assets were
copied into this repository.

## Licensing summary (read first)

| Project | License | What we may do |
|---|---|---|
| AIRI (moeru-ai/airi) | MIT | Study, adapt patterns, reuse code with attribution |
| Xiaoke AI (liupig/xiaokeai) | Apache-2.0 code. **Models, motions, music and voices are not licensed.** "xiaoke.ai" name is not licensed | Code with NOTICE. **No assets.** |
| YUI (yw0nam/YUI) | **PolyForm Noncommercial 1.0.0** | Study ideas only. **Do not copy code** (it would make this project noncommercial) |
| Exuvia | Apache-2.0 | Patterns |
| Liqu Companion | **No license** (all rights reserved) | Ideas only |
| ASHURA | **No license** | Ideas only |
| Pet Assistant | MIT (C#) | Patterns |
| Lala Companion | **AGPL-3.0** | Ideas only. Copying would force AGPL |
| moeChat (moeru-ai/chat) | MIT; last push 2025-08 (inactive) | Patterns |

Rule for this repo: **no third-party code is copied without its license header and a
`THIRD_PARTY_NOTICES` entry. No third-party VRM/VRMA/audio asset is bundled unless its license
explicitly allows redistribution.**

## Snapshot

| Project | Stars | Lang | Last push | Desktop runtime | Character |
|---|---|---|---|---|---|
| AIRI | 50.9k | TS (Vue) | 2026-10-29 | Electron 43 (`apps/stage-tamagotchi`) | VRM (three-vrm 3.5), Live2D, MMD, Spine |
| Xiaoke AI | 239 | Python + JS | 2026-10-29 | Electron shell + FastAPI backend | VRM, MMD (PMX), GLB |
| YUI | 17 | TS | 2026-10-29 | **Tauri 2** (Rust) | VRM + VRMA |
| Exuvia | 2 | JS | 2026-09-20 | — | GLB/FBX |
| Liqu Companion | 11 | JS | 2026-07-02 | — | VRM import |
| ASHURA | 1 | TS | 2026-09-15 | — | 3D chibi |
| Pet Assistant | 1 | C# | 2026-05-19 | WPF | — |
| Lala Companion | 43 | TS | 2026-03-12 | — | 3D |
| moeChat | 78 | TS | 2025-08-20 | WebXR | — |

The last six were reviewed at metadata level only. The first three cover every capability we
need, and the licenses of Liqu, ASHURA and Lala rule out reuse anyway.

## 1. AIRI (moeru-ai/airi): primary reference

**Architecture.** pnpm + turbo monorepo. `apps/stage-tamagotchi` (Electron desktop),
`apps/stage-web`, `apps/stage-pocket` (mobile). There are ~60 packages: `stage-ui-three` (VRM via
TresJS), `model-driver-lipsync` (**wlipsync**), `provider-inference` (xsai), `memory-pgvector`,
`plugin-protocol`/`plugin-sdk`, `drizzle-duckdb-wasm`, `audio`/`pipelines-audio`, and
`services/computer-use-mcp`.

**Desktop rendering.** The main window uses `frame:false, transparent:true, hasShadow:false`, with
`type:'panel'` on macOS for always-on-top over full-screen apps. There are separate windows for chat,
settings, caption, notice, onboarding, and a desktop overlay. A window manager reuses windows. Bounds are
persisted per display. `protectPrivilegedWindowNavigation` blocks renderer navigation and opens
safe links externally. Dragging uses `electron-click-drag-plugin`.

**Security observations.** The main window runs with **`sandbox: false`** and a preload. There is a
typed RPC layer (`@moeru/eventa`) over IPC. A local HTTP "channel server" has its own auth and
session store. Lesson: their RPC typing is worth copying, but we keep `sandbox: true`.

**AI providers.** xsai abstraction over many OpenAI-compatible providers. The provider layer is
separate from the character.

**Voice.** Kokoro-js (local TTS), Apple speech plugins on macOS, a realtime-voice example repo,
and wlipsync for viseme lip sync from audio.

**Memory.** pgvector / DuckDB-WASM + Drizzle. That is heavier than we need.

**Tools.** MCP (`@modelcontextprotocol/sdk` ^1.30), computer-use MCP service, Home
Assistant, game agents.

**Claude Code integration.** `plugins/airi-plugin-claude-code` is a CLI that reads **Claude
Code hook events from stdin** (`HookInput` type from `@anthropic-ai/claude-code`) and forwards
them to AIRI's local channel server (e.g. `UserPromptSubmit` → `input:text`). This is a
documented, supported integration point (hooks). No credential scraping.

**Packaging.** electron-builder, electron-updater, notarization.

**Take:** Electron + transparent window recipe, separate chat/settings windows, wlipsync,
three-vrm + VRMA, hook-based Claude Code bridge, and a typed IPC contract.
**Avoid:** monorepo scale, Vue (we chose React), `sandbox:false`, vector DB, a large provider zoo.

## 2. Xiaoke AI (liupig/xiaokeai)

**Architecture.** `companion/` = Vue frontend + **FastAPI backend** + Electron shell, and
`companion-3d/` = a small Vite + three + three-vrm prototype. The backend pulls in PyTorch-class
speech (Qwen3-TTS from a git branch, transformers 5.x), sherpa-onnx ASR, mem0ai,
fastembed, and edge-tts. The Windows release is a two-part 7z (the model pack is on Baidu Netdisk).

**Desktop rendering ("desktop pet").** A transparent, `alwaysOnTop` window at level `'floating'`.
`setIgnoreMouseEvents(true, {forward:true})` keeps empty space click-through, and it flips to
`false` when the cursor is over the character's body (hit-test). Drag the body to move, drag a corner
to resize. It remembers its display and position and recovers when a monitor is unplugged. The tray menu has unit tests.

**Security observations.** `nodeIntegration:false, contextIsolation:true, sandbox:true`.
URL allow-listing restricts loads to loopback hosts.

**Character.** VRM/PMX/GLB, VMD dance, camera shots, expressions per line, lip sync.

**Memory.** Local SQLite (sqlmodel) + mem0 long-term memory, with toggles to turn modules off.

**Take:** The click-through hit-test pattern, display-loss recovery, sandboxed renderer, and
modules-as-toggles. Strong asset-license hygiene (empty asset folders + README).
**Avoid:** the Python backend and GPU-class local models. That is exactly the "heavy local
models / unnecessary services" your spec says to avoid.

## 3. YUI (yw0nam/YUI): ideas only (noncommercial license)

**Architecture.** Tauri 2 + TypeScript + Vite. Uses `three` 0.180, `@pixiv/three-vrm` +
`three-vrm-animation` (VRMA motions), `@ricky0123/vad-web` (voice activity detection),
`openai` SDK, DOMPurify + marked (sanitized markdown), and `@cfworker/json-schema` (validates tool
input).

**Behaviour.** The character perches on window tops and walks between windows. Gaze follows the
cursor. Proactive speech is rate-limited ("speaks first, with restraint"). There are up to 4
characters, Tavern Card import, emotion crossfade/easing, and interruptible voice.

**Providers.** "Bring your own brain": any OpenAI-compatible chat endpoint (OpenAI, Ollama,
LM Studio, Groq) that **requires tool-calling** for expressions. There is also a "push" transport for
agent backends. TTS: OpenAI, Fish Audio, Irodori. STT: OpenAI-compatible transcription, Groq.

**Claude Code integration (`integrations/yui-notify`).** A Claude Code **plugin with hooks**:
`Stop` → `agent.done`; `PermissionRequest` → `agent.needs_input`;
`Notification(elicitation_dialog)` → `agent.needs_input`; `SessionStart` warns if the app is
unreachable. Hooks run `async` and POST to a **loopback-only** ingress (default port 8770). Headless
`claude -p` runs are excluded. This is the cleanest model for our "notify me when Claude Code
finishes / needs permission" feature.

**Take (as ideas, re-implemented from scratch):** the expression-via-tool-call pattern, emotion
crossfade, VAD-gated push-to-talk, sanitized markdown, JSON-schema validation of tool args,
async loopback hooks.

## Cross-cutting conclusions

1. **Electron is the right runtime.** AIRI and Xiaoke ship transparent always-on-top Electron
   pets on Windows. Tauri (YUI) is lighter but would put privileged code in Rust and make the MCP
   TS SDK / Claude Agent SDK second-class.
2. **three + @pixiv/three-vrm 3.5 + three-vrm-animation** is the shared character stack. **wlipsync**
   (MIT) is a proven audio → viseme lip-sync path.
3. **Claude Code integration = hooks for status + headless CLI for task submission.** Both
   references avoid the website and credentials.
4. **Voice should be adapter-based with a no-setup default.** Every reference pays heavily for
   local speech. Cloud STT/TTS needs keys. We default to OS voices (Chromium `speechSynthesis`, offline
   on Windows) and make STT a configured adapter.
5. **No reference needs a vector DB to be useful.** SQLite with explicit memories covers our v1.
6. **Asset licensing is the most common trap.** No repo ships redistributable character models
   by default.
