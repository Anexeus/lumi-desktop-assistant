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

## ADR-040 PC actions through narrow tools, still no shell (2026-10-29)
The user asked for Lumi to control the PC "without restrictions". Lumi now clicks and types in its own browser window,
writes notes and files in approved folders (with backups), opens Windows' own apps, and downloads files. It still has no
shell and runs no model-generated commands: a 4B local model that reads web pages can be steered by those pages, and a
shell would turn one bad step into real damage. Each new tool is `act` risk (asks; "Allow for this chat" stops repeats).
Browser control uses DOM item numbers instead of screen vision, because qwen3:4b can't see. Supersedes ADR-039's scope.

## ADR-041 Window motion drives spring-bone physics (2026-10-29)
Dragging moves the OS window, not the model, so VRM spring bones never saw motion. The renderer feeds each drag delta into
a damped spring that offsets the model root; hair and clothes then swing through three-vrm's own spring bones.

## ADR-042 Bundle llama.cpp + whisper.cpp; download models on first use (2026-10-30)
Requirement: local Qwen3 with no separate Ollama. llama-server (MIT) speaks the OpenAI API with tool calling, so the
existing adapter works unchanged; its Vulkan build covers NVIDIA/AMD/Intel GPUs with a CPU fallback in ~90 MB (the CUDA
build is 280 MB + 390 MB of runtime). whisper-server (MIT, 17 MB) serves speech-to-text on the same OpenAI path.
Models (2.5 GB + 190 MB, Apache-2.0/MIT, redistributable) are downloaded on first use rather than bundled: a 3 GB
installer is fragile, and the models are verified by SHA-256 either way. Engines are pinned by release and checksum in
`scripts/fetch-runtimes.mjs`. Runtime dependency count is unchanged (binaries, not npm packages). Qwen3 runs with thinking
off on the built-in engine (`enable_thinking:false`): desktop tasks went from 110 s to 5 s.

## ADR-043 Providers through OpenAI-compatible endpoints, one key per provider (2026-10-30)
Gemini, Anthropic, Groq, OpenRouter and OpenAI all offer OpenAI-compatible chat endpoints, so one adapter and one test
path serve them. Capabilities differ and are declared per provider (vision, speech-to-text). Keys are stored per provider
(DPAPI via safeStorage) so switching providers no longer deletes a key; a "custom" key stays bound to its address.

## ADR-044 Desktop control through UI Automation in a bundled PowerShell helper (2026-10-30)
Considered: FlaUI/.NET (needs a .NET runtime and a build step), pywinauto (Python), native Node addons (rebuilds per
Electron version). Windows PowerShell 5.1 and .NET UIAutomationClient ship with every Windows 10/11, so a fixed script
reading JSON requests is zero-dependency. Controls are numbered from the accessibility tree and operated through their
patterns first; coordinate clicks are a fallback. The model never supplies a command, only operation names and values.
Every action returns the re-read window so success is judged from evidence. Windows OCR fills in when UIA sees little.

## ADR-045 Project scripts, not a shell (2026-10-30)
The user asked for "run the dev server / tests / build". Lumi runs `npm run <script>` only when that script exists in an
approved project's package.json, via node + npm-cli.js (no shell, explicit cwd, timeout, cancel, owned-process cleanup).
This keeps the invariant "no general shell, no model-generated commands": the project's own scripts are the allow-list.

## ADR-046 Screenshots leave the PC only by explicit switch (2026-10-30)
qwen3 is text-only, so "seeing" uses UI Automation and OCR locally. A screenshot can go to a vision-capable cloud model
only with Settings → Tools → "Let cloud AI see screenshots" (off by default), a vision-capable provider selected, and an
approval naming the destination each time.

## ADR-047 Qwen3-VL 4B Instruct as the default built-in model (2026-10-30)
Same size and GPU budget as Qwen3 4B, but an instruction-tuned (non-thinking) model that follows tool instructions more
reliably and can see images through its vision adapter (mmproj, 454 MB), which replaces Windows OCR where that is broken.
Official Qwen GGUF, Apache-2.0, verified by SHA-256. Measured here: answers in ~3.6 s, "open Notepad and type" 5 s,
"play a lofi song on YouTube" 11 s with the video playing. Context raised to 16k with an 8-bit KV cache.

## ADR-048 Opt-in "do what I ask without asking first" (2026-10-30)
The owner asked for no approval cards. Act tools then run immediately; the red island, the emergency stop
(Ctrl+Alt+Shift+X) and per-plugin switches remain, and a stop still cancels anything in flight. Off by default for new
installs. Risk accepted by the owner: a web page the model reads could steer it into an action without a prompt.

## ADR-049 Settings is a view of the chat window, with tabs (2026-10-30)
One window instead of two; a tab bar (General, AI, Voice, Character, Tools, Integrations, Claude Code, Memory) instead of
one long page. `openWindow('settings')` switches the chat window's view, so the tray, menu and buttons all agree.

## ADR-050 Network ad blocking with @ghostery/adblocker (2026-10-30)
uBlock Origin can't run in Electron's extension support. Ghostery's MPL-2.0 engine (EasyList + EasyPrivacy, prebuilt,
cached) blocks ads and trackers in Lumi's browser session through `webRequest`. Its Electron wrapper resolves a preload
file at load time, which isn't shipped in the installer, so the core engine is used directly. Bundled by Vite
(devDependency, pinned at 2.20.1, released three weeks earlier); `zod` stays the only runtime dependency.

## ADR-051 Start Ollama attached, not detached (2026-10-30)
A detached Ollama has no console, so every helper it starts (GPU probe, device listing, model runner) got its own
visible console window — the "cmd windows keep opening" bug. Attached with `windowsHide`, they share Lumi's hidden
console. Ollama now stops when Lumi quits, which the built-in engine makes moot.

## ADR-034 Own Markdown subset instead of a Markdown library (2026-10-29)
Local models write paragraphs, lists, bold, inline code and fences. A 50-line parser renders exactly that as React text
nodes, so there is no HTML path to sanitize and no dependency. Links and images are intentionally not rendered.

## ADR-052 The island sits on the OS Acrylic material, not a CSS pill (2026-10-30)
The owner wanted the island blurred like the Windows taskbar. CSS `backdrop-filter` only blurs the page itself, never
the desktop, so real blur needs `backgroundMaterial: 'acrylic'`. Probed on this PC: Acrylic works on a frameless,
non-transparent window (resizable or not) with Windows 11's rounded corners and shadow; a transparent Acrylic window is
square; `setShape` (a pill-shaped region) is ignored for Acrylic windows. So the island is a rounded Acrylic bar with a
neutral dark tint and no colours of its own; the only colour is the Siri-style orb (red while Lumi controls the PC).
Older Windows (no Acrylic) gets the transparent window with an opaque tint.

## ADR-053 Rebindable global shortcuts (2026-10-30)
Settings → General → Keyboard shortcuts records a new combination for show/hide character, the island, and the
emergency stop. Accepted only with Ctrl, Alt or Win (Shift alone, or a bare key, would swallow typing in every app),
modifiers in a fixed order, one key from a fixed list (`src/shared/shortcuts.ts`, also the zod check). A combination
another Lumi shortcut uses is refused; one another app owns fails to register and the old keys are restored. Physical
key positions (US names) are recorded, so on non-QWERTY layouts a letter may differ from its label.

## ADR-054 Peeking from screen edges and sitting on app windows (2026-10-30)
Dropped next to an outer left/right screen edge, the character slides half past it and leans in (a pose, no new
window). Dropped with an app window's top edge between her hips and feet, she sits on it and follows it; when it is
minimised, closed, maximised or moved too high she falls to the bottom of the screen. Electron cannot see other apps'
windows, so two read-only operations were added to the existing desktop helper: `frames` (titled, visible, uncloaked
app windows, topmost first, visible-frame bounds via DWM) and `frame` (one window). They return positions only, never
content or titles, run in compiled C# (8–17 ms), and are polled only while she sits (300 ms; 30 ms while the window
moves). The placement maths is pure (`peekPlacement`, `seatPlacement` in geometry.ts) and unit tested. The camera now
centres on the hips, so lopsided models (a prop held to one side) stand in the middle of their window and line up.

## ADR-055 Settings are validated one by one (2026-10-30)
The saved settings were validated as one object, so one invalid or unknown field (written by another Lumi version, or
a value that later became invalid) reset every setting to its default — the likely cause of the owner's settings
"reverting to Ollama". `parseSettingsFile` validates each top-level setting separately; a bad one is reset alone and
logged. Nested groups are still validated whole.

## ADR-056 The island is a CSS pill by default; frosted glass is an option (2026-10-30)
The owner asked for curved (pill) sides after asking for taskbar blur. Windows can't do both: probed on this PC, an
Acrylic window ignores Electron's `setShape`, a `SetWindowRgn` pill region set from another process, and the
compositor accent policy (which turned a transparent window solid black); a native WinForms window with the accent and a
pill region also stayed rectangular. So the island has two looks (Settings → General → Island look): **Pill** (default)
is a transparent window with a near-black CSS capsule (anti-aliased round ends, no blur), like a phone's Dynamic Island;
**Frosted glass** is the Acrylic window from ADR-052. Transparency is fixed at window creation, so switching recreates
the island window. It also got smaller (300×36; open 440×340).

## ADR-057 Lumi's own menu window instead of the native context menu (2026-10-30)
Native Win32 menus can't be styled. The character's right-click and the tray's right-click open one small transparent
window drawn like the island (header with the orb and status, icons, a switch for "Keep on top", Stop with its shortcut,
Quit), opened at the pointer and flipped at screen edges, closed by Esc, a click elsewhere (blur) or running an item.
`menu:run` is accepted only from that window; items map to the existing tray actions. Keyboard: arrows, Home/End,
Enter. The dev-only "Preview state" submenu went with the native menu.

## ADR-058 More characters: the rest of VRoid's CC0 samples; Miku and Teto by link only (2026-10-30)
Added Vita, Bibi, Victoria Rubin and Darkness Shibu (VRoid AvatarSample F, E, G, D-darkness; CC0 per the VRoid Project
release on OpenGameArt, and their embedded VRoid Hub licence allows redistribution, modification and commercial use).
Hatsune Miku and Kasane Teto can't be bundled: the free VRMs found (e.g. RIDEREX's on BOOTH) forbid redistributing the
model data, and Miku's character rights belong to Crypton. Settings → Character links to VRoid Hub searches instead
(fixed URLs, opened by main), and the user imports a model for personal use with "Use my own .vrm file…".

## ADR-059 Sitting side-on; the taskbar is a seat (2026-10-30)
Facing the viewer with the thighs raised, a skirt skinned to the thighs lifts and shows what it shouldn't (seen on
Victoria, Shibu, Bibi; lowering the thighs or bringing the knees together did not fix it). Sitting, she now turns ~83°
toward the middle of the screen (thighs along the edge, lower legs over the front) and turns her head back to the
viewer: an unmistakable sitting silhouette and nothing to see under a skirt. Dragging her feet below the work area sits
her on the taskbar's edge (no helper needed); most of the owner's windows are maximised, whose top edge is off limits.
The window-top drop tolerance widened to hips−40 … feet+60 px.

## ADR-060 The AI acts on its own: any installed app, play_video, WhatsApp, and a "full permission" prompt (2026-10-30)
The owner's AI kept answering with links or "set it up in Settings → Tools" instead of acting. Causes found by driving
the real models: `apps_open` only knew allow-listed apps (its refusal sent the model to Settings), and a 4B model often
stops halfway through multi-step jobs. Now `apps_open` opens anything in the Start menu (the shell's AppsFolder, launched
with its default verb by id from that list: no command line) and the user's folders (Downloads, Documents…);
`play_video` searches YouTube and starts the first real video in one call; `whatsapp_message` opens WhatsApp Web's send
link in the user's browser and presses its Send button through UI Automation. With "Do what I ask without asking first"
on, the system prompt says the user gave full permission, to act without asking, never to answer with a link when asked to
open or play something, and to pick something sensible when details are missing. Verified with both local models
(UPGRADE_PROGRESS 0.6.0). Still no general shell tool (CLAUDE.md invariant): commands can only be typed into a visible
Terminal through desktop control, where the user sees them and the emergency stop works.

## ADR-061 SQLite rollback journal instead of WAL (2026-10-30)
Chats and a settings change made after 13:50 were missing from assistant.db after Lumi closed: they had lived only in
the -wal file, which was gone (and a live -wal once read as "malformed" from another process). One process needs no WAL
concurrency, so the store uses `journal_mode = DELETE`: every committed change is in assistant.db itself, and a copy of
the file is always complete. Opening an old WAL database converts it.

## ADR-062 Development runs use their own AppUserModelID (2026-10-30)
Lumi's taskbar button showed Electron's atom icon. A Start-menu `Electron.lnk` (made by Electron for notifications during
development runs) carried the same AUMID as the installed `Lumi.lnk`, so Windows took its icon. Unpackaged runs now use
`dev.desktop-assistant.app.dev`; the stray shortcut on the owner's PC was removed and the icon cache refreshed.

## ADR-063 Chat and Settings in the island's look; Windows' dark theme forced (2026-10-30)
The owner wanted every panel to look like the island and the menu. One palette replaces light/dark: black glass (80 %
over the OS Acrylic), white text, white as the only accent (white pills with black text for primary actions, the selected
tab, switches and checkboxes), pill-shaped buttons and single-line fields. `nativeTheme.themeSource = 'dark'` keeps the
Acrylic and native controls dark. Status colours (the green "on this PC" dot, red stop, amber warnings) remain.

## ADR-064 Sitting faces the viewer again (2026-10-30)
Supersedes the side-on pose of ADR-059 at the owner's request ("sit in front of me, on the edge; I don't care how it
looks"): thighs forward over the window's top edge, lower legs hanging in front of it. The taskbar seat and the wider drop
tolerance from ADR-059 stay.

## ADR-065 Lumi acts without asking by default; app installs through winget (2026-10-31)
The owner wants the assistant never to ask for permission. "Do what I ask without asking first" is now on for new
installs too (ADR-048 had it off by default); it can still be turned off in Settings → Tools, and the emergency stop and
plugin switches remain. New tool `app_install`: winget searches its catalog for the name the model gives and installs the
package id winget reports (`-e --silent`), with an argument list and no shell. Risk accepted by the owner: with approvals
off, text the model reads (a web page) could talk it into installing software from winget's catalog. On a PC whose winget
is broken (this one: "Data required by the source is missing") the tool says how to repair it.

## ADR-066 Hatsune Miku (RemiX3) is the default character; the owner's other models stay personal (2026-10-31)
The owner asked to ship `2951434776750077865.vrm` (by KuroG) as the default. Its embedded VRoid Hub licence says
redistribution: disallow, so it cannot be in the installer; it is the owner's personal model on their PC instead. Of the
other two, "Hatsune Miku!" by RemiX3 allows redistribution with credit (non-commercial, unmodified): it is bundled,
credited (plus "Hatsune Miku © Crypton Future Media, INC. www.piapro.net") and is the default for new installs. The third
(`7423572281241392855.vrm`) allows redistribution with credit but names no author and isn't on VRoid Hub's API, so it
can't be credited and isn't bundled.

## ADR-067 Speech-to-text falls back to Lumi's Whisper; providers' errors are shown (2026-10-31)
With Gemini selected and voice input on "AI service", every recording failed with "Transcription failed (404)": Gemini,
Anthropic, OpenRouter and Lumi's engine have no `/audio/transcriptions`. Those providers now always use Lumi's Whisper;
providers that have one use their own speech model (Groq `whisper-large-v3`, OpenAI `whisper-1`; before, every service
was asked for Ollama's `lfm3-audio`). Gemini returns errors as a JSON list, which Lumi used to drop; the message is now
shown (e.g. "Please pass a valid API key").

## ADR-068 Desktop Mate–style poses, clicks and the title-bar orb (2026-10-31)
Picked up, she dangles (tipped forward, arms reaching down, legs hanging apart, looking up); sitting, she sits upright
facing the viewer with her hands on her knees, on a window's top edge or the taskbar. Peeking puts her body's centre
line on the screen edge (half of her shows). One click on her opens the menu (with a wave and a cute line), a double
click opens Settings. The chat window's coloured status dot became the animated orb. A 32-bit Windows gets a clear
installer message ("Lumi needs 64-bit Windows") instead of a later "This app can't run on your PC".

## ADR-069 A saved key that can't be decrypted is deleted (2026-10-31)
The owner's Gemini key was saved but could no longer be decrypted, so Lumi sent requests without it and Google's
"Missing or invalid Authorization header" was all they saw, while Settings still said "A key is saved". Such a key
can never be read again (Windows' key for it is gone), so Lumi now deletes it when reading fails (checked at start
for the selected service, and on every use). Settings then asks for it, and a chat with a service that needs a key
and has none says "Lumi has no API key for <service>. Paste it in Settings → AI." instead of sending the request.

## ADR-070 Gemini defaults to gemini-3.6-flash; a cloud "model not found" points to Settings (2026-10-31)
With a new key Gemini answered 404 for `gemini-2.5-flash` and Lumi showed "For Ollama, run: ollama pull …". Google's
model page lists the 2.5 models as legacy, served only to projects that used them before; the owner's project is new.
Checked through Lumi itself with the owner's saved key (on a copy of the profile; the key never left the app):
`gemini-3.6-flash` and `gemini-flash-lite-latest` answered in 1–3 s, while `gemini-3.8-flash` (what
`gemini-flash-latest` points to now) hung ~80 s and then returned 503 "high demand". So the default is the pinned
`gemini-3.6-flash`, with the lite alias and the newest alias as suggestions. A 404 about the model now names the
Ollama fix only for Ollama (port 11434); any other service gets "doesn't offer the model … Pick another model in
Settings → AI."

## ADR-071 Clicks, picking up and the taskbar seat, second pass (2026-10-31)
Supersedes the click and taskbar parts of ADR-068, after the owner's screenshots. One click no longer opens the menu
(it popped up whenever they meant to grab her): she waves with a cute line; a double click (within 450 ms, close to
Windows' 500 ms default) opens Settings; the menu stays on right-click. Held, the idle gestures had kept playing (a
"stretch" put both arms overhead); now no gesture starts or runs while she is held, and sitting or peeking only allows
the head-only ones. Held, she hangs from the top of her head and swings behind the cursor like a pendulum (at most
0.22 rad, so her feet stay inside her window), legs kicking in turn with toes pointed, arms loose. On the taskbar her
legs used to hang below the screen (a taskbar is ~48 px tall): sitting there is now the `floor` perch, knees drawn up,
and she rises by an amount computed from the model's own thigh, shin and sole so her soles rest on the taskbar's top
edge (checked with Miku and the owner's model: on the line within ~6 px; long hair and sashes still hang lower).

## ADR-072 Taskbar sit, picking up, own models and Gemini tool calls, third pass (2026-10-31)
Supersedes the held and taskbar parts of ADR-071, which the owner found ugly. Held, she dangles as in ADR-068 again
(tipped forward, arms reaching down and out, legs kicking; no pendulum). On the taskbar she sits on its top edge with her
legs hanging in front of it, as on a window (`sit`; the knees-up `floor` perch is gone). Her legs used to vanish
behind the taskbar: Electron's `floating`…`status` levels put a window *below* the Windows taskbar, so her window now
uses `pop-up-menu` and re-asserts it every 1.5 s while she sits there (not while her own menu is open). The island
stays on `floating`.
Own models: Lumi kept one (`models/custom.vrm`, always shown when present and missing from the menu). Now any number
live in `models/mine/<sha256-12>.vrm` with the id `mine:<hash>`, are listed in Settings → Character and the right-click
menu, and can be removed; the old file moves in at start. A model without a title (some exporters write "null") is
named after its author, or else after its file name.
Gemini 3 and tools: Gemini's OpenAI-compatible endpoint puts a `thought_signature` in each tool call's `extra_content`
and answers 400 "Function call is missing a thought_signature" when the next request doesn't send it back. Lumi keeps
`extra_content` on tool calls and returns it unchanged; for Google only, a tool call that has none (one Lumi made
itself) gets Google's documented placeholder `skip_thought_signature_validator`.

## ADR-073 Ideas from Mate Engine, not its code or assets; personal-only models (2026-10-31)
The owner put Mate Engine X3.3.0 (a Unity desktop mate) in the project folder and asked to use its models, animations
and voices. Its code is under the "MateEngine Pro License" (any derivative must take that licence; non-commercial; no
binary distribution platforms), its assets are "© Shiny, strictly copyrighted" and may not be redistributed separately,
and its default avatar is All Rights Reserved. Copying either would put Lumi under that licence or break it, so, as
with YUI and Lala, Lumi takes only ideas, written fresh:
- The head, neck and chest follow the cursor (at most ±0.6 rad sideways and ±0.35 rad up or down, eased).
- Stroking her head with the cursor is a head pat: a big smile and a head tilt, with a "Hee hee!".
- After 3 minutes with no cursor movement, clicks or chat she naps (eyes shut, head drooping, slow breaths), and any
  activity wakes her with a stretch.

The folder is git-ignored and lint-ignored and was never committed.
The owner also added `HatsuneMikuNT.vrm` (止丸式初音ミクNT) to the bundled models. Its readme and VRM licence forbid
redistribution and commercial use, so it can't ship. It stays one of the owner's own models on their PC, and the file
went back next to its readme in Downloads.

## ADR-074 The island's voice: tap to stop, a more sensitive ear, logged failures (2026-10-31)
The owner said tapping the island didn't hear them, while push-to-talk worked. Push-to-talk records whatever is said.
Voice mode has to detect speech first, and its floor of 0.02 RMS is louder than a soft voice on a laptop mic with
noise suppression. The floor is now 0.01; the adaptive 3× room-noise rule still rejects fans. A Windows voice could
leave her in SPEAKING forever if Chromium never fired `onend`, and voice mode ignores the mic while she talks. So the
utterance is kept referenced, and a watchdog finishes it once nothing is speaking. Transcription failures now go to
the log. A tap on the island while she thinks or talks stops her, and stops voice mode too.
The likeliest cause on the owner's PC turned up later. Their real profile has "Only respond when I say the name" on,
and push-to-talk ignores that setting. Voice mode dropped every sentence without "Lumi" without a word, so it looked
deaf. Now, with the name check on, the island says "Listening for “Lumi, …”", and an ignored sentence gets "Heard
you, but only “Lumi, …” is sent (Settings → Voice)". The owner's mic was not available for testing.

## ADR-075 Mate Engine's animations, sounds and avatars, imported from the user's own copy (2026-10-31)
Partly supersedes ADR-073. The owner asked again for Mate Engine's animations, voices and models, "copy the whole
project". Two limits stay. Its code is Unity C# under the copyleft MateEngine Pro License, so it is neither copied
nor ported. Its assets are "© Shiny": personal and non-commercial use is allowed with credit, redistribution is not.
So nothing of it ships in Lumi's installer or repository. Instead, Settings → Character → "Import from Mate Engine…"
(or `Lumi.exe --import-mate=<folder>`) reads the user's own copy into their profile (`userData/mate`):
- 56 clips are converted once: 19 idles, a male set, picked up, two edge sits, sleeping, head pat, six reactions and
  12 dances.
- The voice pack and reaction sounds are copied.
- Its three VRM avatars (each "Redistribution_Prohibited", usable by everyone) join the user's own models.

Settings credits Shiny. The clips are Unity humanoid "muscle" curves, which a VRM can't play directly.
`src/main/mate/` converts them with Unity's swing-twist model (local = neutral × swing × twist). Unity's own axis
tables are internal, so the axes and signs come from the muscles' names. The neutral ("motorcycle") pose, the share
of the spine bend inside Unity's body rotation (65%) and the foot-goal offset were fitted against the hand and foot
positions every clip also stores. Mean error: 0.08 of the centre-of-mass height across idle, sit and drag clips, and
a unit test keeps it under 0.1 where Mate Engine is present. The hips are placed from Unity's centre of mass with a
segment-mass model, and each clip is centred and turned to face the viewer.

The character window plays the clips with three's AnimationMixer and picks one for what she is doing:
- **Roles:** standing (a new idle every ~12 s, as Mate Engine does), picked up, sitting on an edge, asleep, petted,
  a click reaction, or dancing (the menu's "Dance"; picking her up stops it).
- **Kept from Lumi:** her face, blinking, mouth, gaze and cursor-following are added on top.
- **Peeking:** stays Lumi's own lean-in pose, because Mate Engine's "hide" clips are a bow.

Without an import, Lumi animates exactly as before. Clip and sound reads are limited to the character window and to
ids listed by the import (zod-validated file names, never paths).

## ADR-076 One icon everywhere: the UI's orb (2026-10-31)
The exe, installer, taskbar, tray and window icons showed the 0.3 violet face, while the island, chat and menu show the
gradient orb. The owner asked for one look everywhere. `scripts/make-icon.mjs` renders the UI's orb (orb.css, frozen)
with Electron into `build/icon.png` and a PNG-entry `build/icon.ico` (16–256 px); `make-icon.py` is gone. Mate
Engine's icons were not used: they are its branding.

## ADR-077 With the name check on, a conversation doesn't need her name every time (2026-10-31)
The owner's "Got it…" and then nothing was the name check (ADR-074): every sentence without "Lumi" was dropped. Tapping
the island, or her finishing an answer, now opens a 30-second window in which sentences count without her name. The
name is needed again only after a quiet half minute, which is what the check is for (a TV in the background).
