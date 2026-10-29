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
  Default to Manual with prompts bridged to the user.
- `claude -p` runs a project's hooks and `.mcp.json` **without a trust prompt**. Only run tasks in
  folders the user explicitly approved, and show that warning when a folder is added.
- The hook ingress binds `127.0.0.1` only, requires a per-install token, rate-limits requests, and validates payloads.

## Development-tool risks (this repo)

- Graphify and Ponytail hooks execute on every relevant tool call. Both were source-reviewed
  (see `DEVELOPMENT_TOOLS.md`). Re-review on upgrade.
- OmniRoute was not installed. Its subscription-OAuth pooling conflicts with provider terms.
- Third-party skills are instructions with full agent permissions. Treat updates like code changes.

## Dependency policy

Pin with a lockfile. Run `npm audit` at each milestone. New dependencies need a reason in
`DECISIONS.md` if they are runtime (not dev) dependencies. Review postinstall scripts.
