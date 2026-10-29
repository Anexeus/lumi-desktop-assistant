# Architecture

Status: **proposal** (Milestone 0). Nothing below is implemented yet. See `CURRENT_STATE.md`.

## Shape

One Electron app, three process roles, no extra services.

```
┌──────────────────────── Main process (Node, privileged) ─────────────────────────┐
│ AppController ─ WindowManager (character, chat, settings) ─ Tray ─ Shortcuts     │
│                                                                                   │
│ Conversation engine ── ProviderRegistry ── adapters: Anthropic API, OpenAI-compat │
│        │                                                                          │
│        ├── ToolRegistry ◄── PluginRegistry (first-party plugins)                  │
│        │        │                                                                 │
│        │   PermissionBroker  ◄── user confirmations (dialog in chat window)       │
│        │        │                                                                 │
│        │   Tools: fs (approved roots), launcher (allow-list), notify, docs,       │
│        │          MCP client (approved servers), claude-code task runner          │
│        │                                                                          │
│ Storage: SQLite (settings, notes, memories, history*, projects, audit log)        │
│ Secrets: Electron safeStorage (DPAPI) — never sent to a renderer                  │
│ ClaudeCodeBridge: loopback hook ingress + `claude -p` runner                      │
└───────────────▲──────────────────────────────▲───────────────────────────────────┘
                │ typed, validated IPC          │ typed, validated IPC
┌───────────────┴─────────────┐   ┌─────────────┴───────────────────────────────────┐
│ Character renderer (sandbox)│   │ Chat / Settings renderer (sandbox)              │
│ three + three-vrm, VRMA,    │   │ React UI, markdown (sanitized), mic capture,    │
│ CharacterStateMachine,      │   │ push-to-talk, TTS playback, permission prompts  │
│ lip sync, hit-testing       │   │                                                 │
└─────────────────────────────┘   └─────────────────────────────────────────────────┘
        (* history only when the user enables it)
```

## Technology choices

| Concern | Choice | Notes |
|---|---|---|
| Runtime | Electron 45.x | Transparent/click-through windows proven on Windows by AIRI and Xiaoke |
| Build | electron-vite 6 + Vite 8 | Separate main/preload/renderer builds, HMR |
| UI | React 19 + TypeScript (strict) | |
| 3D | three 0.186 + @pixiv/three-vrm 3.5 + @pixiv/three-vrm-animation | Behind a `CharacterModel` interface (VRM first, GLB later) |
| Lip sync | wlipsync (MIT) on TTS audio; amplitude fallback; word-boundary fallback for OS voices | |
| Validation | zod 4 | Every IPC payload, tool input, plugin config, MCP tool args |
| Storage | SQLite in main: `node:sqlite` if stable in Electron 45's Node, else better-sqlite3 | Decided at Milestone 5 (ADR-007) |
| Secrets | `safeStorage` encrypted blobs in SQLite | Renderer only sees "configured: yes/no" |
| MCP | @modelcontextprotocol/sdk 1.32 (client, stdio + streamable HTTP) | Milestone 7 |
| Tests | Vitest 5 (unit/integration), @playwright/test 1.64 `_electron` (E2E) | |
| Packaging | electron-builder 26 (NSIS installer) | Milestone 9 |

Python/FastAPI: **not used**. No concrete need. Every reference that adds it does so for local
GPU speech models, which we are deliberately not shipping.

## Key modules

### Windows
- **Character window:** `transparent`, `frame:false`, `hasShadow:false`, `resizable`, always-on-top
  (toggle, level `'floating'`), `skipTaskbar`. Click-through via
  `setIgnoreMouseEvents(true,{forward:true})`. The renderer hit-tests the model with a raycast against
  the mesh / alpha and asks main to toggle. Position and size are persisted per display, and it
  recovers to the primary display if its monitor disappears.
- **Chat window:** a normal framed (or frameless-rounded) window anchored next to the character. It can be expanded or collapsed.
- **Settings window:** providers, voice, memory and data, plugins and permissions, approved folders and apps.
- **Tray:** show/hide, always-on-top, push-to-talk status, quit.

### Character state machine (pure TS, renderer)
States: `IDLE, LISTENING, THINKING, SPEAKING, WORKING, NOTIFICATION, ERROR`.
Events come from main (`conversation.started`, `stream.first_token`, `tts.started`, `tts.ended`,
`tool.started`, `tool.finished`, `ptt.down`, `ptt.up`, `notify`, `error`, `cancel`, `timeout`).
Transitions are a table, and invalid events are ignored and logged. An **animation layer** maps each
state to a base clip (VRMA or procedural) plus additive layers (blink, gaze, lip sync, expression)
with crossfades, so states never fight over the same bones. `NOTIFICATION` and `ERROR` are
transient and return to the previous stable state after a timeout.

### Conversation engine (main)
- `Provider` interface: `listModels()`, `stream(request, signal): AsyncIterable<Delta>`, which
  yields `text`, `tool_call`, `usage`, `done`, `error`. There are per-request `AbortController`s and
  timeouts (connect, first token, total).
- Streams to the chat renderer over a dedicated `MessagePort` per request. Cancel = abort the request.
- Tool loop: provider asks → ToolRegistry validates args (zod) → PermissionBroker → execute →
  the result is wrapped as untrusted data → back to the provider. A max-iterations guard applies.
- Kept separate from Claude Code integration, which is a tool/plugin, not the chat engine.

### Plugin registry, tools, permissions
See `PLUGIN_REGISTRY.md`. Summary: first-party plugins only in v1. Each one declares a
manifest (id, version, permissions, config schema, tools, lifecycle). The **PermissionBroker** in
main is the only path to privileged capabilities. Plugins receive scoped capability objects
(e.g. an fs handle limited to approved roots), never raw `fs`/`child_process`.

### Claude Code bridge
1. **Observer (hooks):** an optional, user-installed hook config (Stop, PermissionRequest,
   Notification, SessionStart) POSTs events to a loopback-only ingress (`127.0.0.1`, random port,
   per-install bearer token) → character `NOTIFICATION` + OS notification. This follows the documented hook mechanism.
2. **Task runner:** the user writes or reviews a task, picks a project folder from an approved list, and picks
   a permission mode (default **Manual**). The app spawns the **user's own installed `claude` CLI**:
   `claude -p "<task>" --output-format stream-json --verbose --permission-mode default`
   in that folder. It parses events for progress, `result` for completion and cost, and
   `permission_denied` for anything that needed approval. Cancellation sends an interrupt (SIGINT
   equivalent), then kills after a grace period. Permission prompts are bridged with
   `--permission-prompt-tool` pointing at an MCP tool the app serves, which shows a confirmation dialog.
   Never `bypassPermissions`.
3. Auth stays inside Claude Code (your login). The app never reads `~/.claude` credentials.
   If the app were distributed to others, it must not offer claude.ai login. It would use
   the Agent SDK with an API key instead (Agent SDK docs).

### Voice
- `SpeechToText` adapters: OpenAI-compatible transcription endpoint (cloud, key) first. A local
  option (sherpa-onnx WASM / whisper) is evaluated later.
- `TextToSpeech` adapters: OS voices via `speechSynthesis` (default: offline, free, no setup),
  OpenAI-compatible TTS (audio → wlipsync).
- Push-to-talk only (global shortcut + on-screen button). The mic is opened per press. A visible
  indicator shows while it is open. No background listening.

### Memory
SQLite tables: `settings`, `secrets` (encrypted), `notes`, `memories` (explicit "remember
this"), `conversations`/`messages` (only if enabled), `projects`, `approved_roots`,
`approved_apps`, `audit_log`. There is a data viewer with per-item and bulk delete. Secrets are detected
and refused on "remember" (pattern check).

## Repository layout (from Milestone 1)

```
src/
  main/        app, windows, tray, ipc (handlers + zod schemas), providers, tools, plugins,
               permissions, storage, claude-code
  preload/     contextBridge API (one per window), no Node exposure
  renderer/
    character/ three/VRM scene, state machine, animation layers
    chat/      React chat UI
    settings/  React settings UI
  shared/      IPC contract types, zod schemas, constants
tests/         unit (vitest), e2e (playwright _electron)
docs/
```
