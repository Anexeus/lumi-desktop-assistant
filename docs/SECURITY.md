# Security

## Threat model (short)

The app holds API keys, reads approved folders, launches apps, and drives Claude Code. The
dangerous inputs are **model output, tool/MCP output, web content, and files**, all of which can
contain prompt injection. The design assumes any of them may try to cause actions.

## Electron baseline (enforced from Milestone 1)

- Every `BrowserWindow`: `contextIsolation:true`, `sandbox:true`, `nodeIntegration:false`,
  `webSecurity:true`, no `webviewTag`, and `preload` exposing a narrow typed API via `contextBridge`.
- Strict CSP via response headers and meta: `default-src 'self'; script-src 'self'; object-src 'none';
  base-uri 'none'; frame-ancestors 'none'`. `connect-src` lists only what the renderer needs.
  Provider calls happen in **main**, so renderers need no external origins.
- Block `will-navigate`, `setWindowOpenHandler` → deny (open allow-listed https links externally
  after validation). Deny `permission-request-handler` except `media` for the chat window during push-to-talk.
- Validate `event.senderFrame` origin on every IPC message. Every payload is parsed with zod, and
  unknown channels are rejected.
- Load only packaged `file://`/custom-protocol content in production. There is no remote content in privileged windows.
- Electron Fuses at packaging: disable `RunAsNode`, `EnableNodeCliInspectArguments`, and
  `EnableNodeOptionsEnvironmentVariable`. Enable ASAR integrity.

Implemented in Milestone 1 (`src/main/security.ts`, `policy.ts`, `ipc.ts`) and covered by unit + E2E tests.
`connect-src` also allows `blob:` (Milestone 2): GLTFLoader decodes embedded textures through blob URLs the page itself creates.
User-chosen models are validated in main (`vrm-meta.ts`: magic, version, bounded JSON chunk, VRM metadata, size cap),
copied into userData, and their bytes are sent only to the character window. Untrusted metadata strings are trimmed and capped.
Open item: a packaged exe still honors Chromium's `--remote-debugging-port` switch. Fuses don't cover it.
Mitigate in Milestone 9 (e.g. refuse to start when the switch is present in a packaged build).

## Microphone and voice (Milestone 4)

Permission requests are denied except **audio-only** media for the chat, island and settings windows while voice input is on;
video is always denied. The mic opens only while push-to-talk records. Transcription is accepted only from those windows,
synthesis only from the character and settings windows. Audio goes only to the configured AI address (local by default).

## Stored data (Milestone 5)

Chats, memories, notes and settings are in `userData/assistant.db`, on this computer only. Memories and notes that look like
passwords, keys, tokens or card numbers are refused (best effort). Chat history cannot be filtered that way, so it can be
turned off and deleted per chat or all at once.

## Secrets

Implemented (Milestone 3): keys go to `safeStorage` (DPAPI) in `userData/secrets.json`, renderers only ever see
`hasApiKey`, and a key is deleted when the AI address moves to another origin. AI requests run in main; the
renderer CSP is unchanged. AI addresses must be http(s) without embedded credentials. Chat input is capped at
8,000 characters and replies render as plain text (no HTML).

- API keys are stored with `safeStorage` (Windows DPAPI). Renderers never receive them.
- Never logged. The logger redacts known key patterns and `Authorization` headers.
- No secrets in docs, tests, fixtures, or git.
- The "remember this" memory refuses strings that look like keys/tokens/passwords.

## Tool and plugin permissions

- One **PermissionBroker** in main. Plugins get capability objects scoped by the broker. They
  never import `fs`, `child_process`, `net` or `shell` directly (enforced by lint rule + review).
- Permission grants are per plugin, per capability, and shown to the user. Consequential actions
  (write/delete files, launch an app, submit a Claude Code task, MCP tools marked non-read-only)
  require a per-action confirmation showing exactly what will happen.
- Filesystem: read-only by default, limited to user-approved roots. Paths are resolved with
  `realpath` and checked for containment (no `..`, symlink or junction escapes, no UNC/device paths).
  Size limits apply.
- Launcher: an allow-list of applications/folders the user added. Targets are validated, launched via
  `shell.openPath` or `spawn` with an argument array (no shell). **No model-generated commands.**
- **No general shell tool.** Ever.
- Tool, MCP and web results are passed to the model wrapped and labelled as untrusted data. They
  cannot change settings, permissions, or approval state.

## MCP

Only servers the user added. The command/URL and source are shown on add. Tools are discovered and shown with
descriptions. Args are validated against the declared schema. Every call has a timeout. Read-only
hints are not trusted for the confirmation decision unless the user marks the server trusted.

## Claude Code

- Use only documented interfaces: hooks and `claude -p`. Never automate claude.ai and never read
  credential files.
- Never pass `--permission-mode bypassPermissions` or `--dangerously-skip-permissions`.
  Default to `plan` (read-only). `manual` denies anything that needs approval and reports it; `acceptEdits` must be
  picked explicitly. A task the model starts (`claude_task`) always asks the user first.
- Installing hooks edits `~/.claude/settings.json` only after the user turns it on, writes a timestamped backup first,
  and uninstall removes only entries marked `lumi-desktop-assistant`.
- `claude -p` runs a project's hooks and `.mcp.json` **without a trust prompt**. Only run tasks in
  folders the user explicitly approved, and show that warning when a folder is added.
- The hook ingress binds `127.0.0.1` only, requires a per-install token, rate-limits requests, and validates payloads.

## Desktop control, project scripts, local engines

- "Do what I ask without asking first" (Settings → Tools, off by default) skips approval cards for act tools. The
  emergency stop, the red island and the plugin switches still apply.
- Lumi's browser blocks ads and trackers (Ghostery engine, network level).
- `apps_open` opens Start-menu apps by the id Windows lists for them (shell AppsFolder, default verb) and the user's
  folders: never a command line. `whatsapp_message` only opens WhatsApp Web's send link (number + text) in the user's
  browser and presses its Send button. With approvals off, the model is told it has full permission (ADR-060).
- The character reads other apps' window **positions** (never titles or content) through the helper's read-only
  `frames`/`frame` operations, only after she is dropped and while she sits on a window.
- Global shortcuts are user-chosen but must include Ctrl, Alt or Win, so they can't capture ordinary typing.
- Lumi's menu is its own sandboxed window; `menu:run` is accepted only from it. External pages it opens (provider key
  pages, VRoid Hub searches) come from fixed lists in main, never from a renderer.

- Desktop control (UI Automation, typing, clicks) runs in a fixed bundled script; requests are JSON data, never code.
  Every action asks first; the red island shows when Lumi is acting; Ctrl+Alt+Shift+X / tray / island stops everything
  (reply, approvals, helper). The whole plugin can be switched off. Elevation prompts are never automated.
- Project scripts: only `npm run <script>` for scripts in an approved project's package.json; no shell; owned processes
  are killed on stop and on quit.
- Local engines bind 127.0.0.1 on random ports; the chat engine requires a per-launch random key. Models are accepted
  only with the publisher's SHA-256; engines are pinned by release digest.
- Screenshots go to a cloud model only with the off-by-default switch, a vision provider, and per-action approval.
- The diagnostic log masks bearer tokens, API keys and token-like strings before writing.

## PC actions

- `browser_open/click/type` act only in Lumi's own browser window (isolated `lumi-web` session, no cookies kept, public
  URLs only, downloads blocked there). Page content stays untrusted data.
- `files_write` writes only text/code extensions, only inside approved folders (realpath containment, existing files must
  resolve inside too, no UNC/device paths), at most 1 MB, and copies the old version to userDataackups first.
- `web_download` follows at most 5 redirects and stops if one leads to a private address; files go to Downloads with a
  unique name, capped at 4 GB, and are never opened or run. Program files are flagged in the approval prompt.
- Built-in Windows apps open with no arguments. There is still no shell and no model-generated command.

## Voice mode and web_open

- Voice mode keeps the mic open only while the user has it switched on (one click on, one click off); audio is never
  saved, only sent to the configured speech-to-text endpoint per utterance. Audio is ignored while Lumi speaks.
- `web_open` hands a public http(s) URL to the default browser after approval. Local/private addresses are refused
  (`isPublicWebUrl`), and the model never runs commands.

## Release hardening

- A packaged build exits when started with `--remote-debugging-port`, `--remote-debugging-pipe` or `--inspect*`
  (Electron fuses already disable Node's inspect arguments, RunAsNode and NODE_OPTIONS).
- A crashed renderer reloads at most 3 times; Lumi's web-reading window is never auto-reloaded.
- Chat Markdown is parsed to data and rendered as React text nodes. No `innerHTML`, no links, no images.
- The installer is not code-signed yet.

## Development-tool risks (this repo)

- Graphify and Ponytail hooks execute on every relevant tool call. Both were source-reviewed
  (see `DEVELOPMENT_TOOLS.md`). Re-review on upgrade.
- OmniRoute was not installed. Its subscription-OAuth pooling conflicts with provider terms.
- Third-party skills are instructions with full agent permissions. Treat updates like code changes.

## Dependency policy

Pin with a lockfile. Run `npm audit` at each milestone. New dependencies need a reason in
`DECISIONS.md` if they are runtime (not dev) dependencies. Review postinstall scripts.
