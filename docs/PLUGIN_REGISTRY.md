# Application Plugin Registry (design)

Runtime plugins of the desktop assistant. **Unrelated to Claude Code development plugins**
(`DEVELOPMENT_TOOLS.md`). Status: design only, implemented in Milestone 6.

## Scope (v1)

- First-party plugins, bundled with the app, running in the main process.
- No marketplace, no downloading, no third-party code loading.
- MCP servers (Milestone 7) appear as plugins of kind `mcp`, configured by the user.

## Manifest

```ts
interface PluginManifest {
  id: string                 // 'core.filesystem'
  name: string
  version: string            // semver
  description: string
  kind: 'builtin' | 'mcp'
  permissions: PermissionRequest[]      // declared up front, shown to the user
  configSchema: ZodSchema               // validated before init
  tools: ToolDefinition[]               // name, description, zod input schema, risk level
}

type Permission =
  | { cap: 'fs.read'; roots: 'user-approved' }
  | { cap: 'fs.write'; roots: 'user-approved' }   // always per-action confirm
  | { cap: 'app.launch'; targets: 'allow-list' }   // always per-action confirm
  | { cap: 'notify' }
  | { cap: 'net.fetch'; hosts: string[] }
  | { cap: 'process.claude-code' }                 // per-task confirm
  | { cap: 'mcp.server'; serverId: string }

interface ToolDefinition {
  name: string
  description: string
  input: ZodSchema
  risk: 'read' | 'consequential'       // consequential ⇒ confirmation dialog every call
  timeoutMs: number
}
```

## Lifecycle

`registered → (user enables) → configured → initializing → ready ⇄ disabled`, plus `error`
(with message, retry button). `init(ctx)` receives **only** the capability objects the broker
granted. `dispose()` must release handles. Disable = dispose + unregister tools, effective
immediately for in-flight conversations.

## Enforcement

- The PermissionBroker creates capability objects (`ScopedFs`, `Launcher`, `Notifier`, …).
  Plugins cannot construct them.
- Every tool call: zod-validate args → check the grant → confirm if `consequential` → run with
  timeout → audit log entry → wrap the result as untrusted.
- Lint rule: `src/main/plugins/**` may not import `node:fs`, `node:child_process`, `node:net`,
  or `electron.shell`.

## Planned built-ins

| ID | Tools | Permissions |
|---|---|---|
| `core.filesystem` | `fs.search`, `fs.read` (later `fs.write`) | fs.read (fs.write later) |
| `core.launcher` | `launcher.open` | app.launch |
| `core.notifications` | `notify.send` | notify |
| `core.docs` | `docs.search` (Context7 or official docs) | net.fetch |
| `core.claude-code` | `claude.submitTask`, `claude.status`, `claude.cancel` | process.claude-code |
| `core.github` | read-only repo/PR/issue queries first | net.fetch (api.github.com), token |

The assistant answers "what can you do?" from the registry: enabled plugins, their tools, and
granted permissions.
