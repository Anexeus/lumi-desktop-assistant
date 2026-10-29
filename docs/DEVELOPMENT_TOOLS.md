# Development Tools

Claude Code development tooling for this repository. Not to be confused with the
application's own runtime plugin registry (see `PLUGIN_REGISTRY.md`).

Verified on **2026-10-29** with **Claude Code 2.1.308** (bundled with the Claude
desktop app at `%LOCALAPPDATA%\Claude-Data\claude_pzs8sxrjxfjjc\claude-code\2.1.308\…\claude.exe`;
`claude` is **not** on the shell PATH).

## Summary

| Tool | Status | Mechanism | Scope |
|---|---|---|---|
| Ponytail | Installed, enabled, hook smoke-tested | Claude Code plugin marketplace | project |
| OmniRoute | **Not installed** (blocked pending your decision) | — | — |
| Graphify | Installed, skill + hooks registered, hook smoke-tested | PyPI via `uv tool`, then `graphify install --project` | user CLI + project skill |
| Addy Osmani agent-skills | 10 of 25 skills installed | `npx skills add … --skill` (documented per-skill method) | project |
| frontend-design | Installed, enabled | official marketplace | project |
| context7 | Installed, enabled; **needs authentication** | official marketplace (remote HTTP MCP) | project |
| typescript-lsp | Installed, enabled; LSP handshake tested | official marketplace + `typescript-language-server` | project |
| code-review | Skipped (duplicate) | — | — |
| code-simplifier | Skipped (duplicate) | — | — |
| superpowers | Skipped (overlap) | — | — |
| playwright (MCP) | Deferred to Milestone 7/9 | — | — |

## Prerequisites installed

| Software | Version | How | Location |
|---|---|---|---|
| Node.js LTS | v24.22.2 (npm 11.19.1) | Official zip from nodejs.org, SHA-256 checked against `SHASUMS256.txt` | `%LOCALAPPDATA%\Programs\node-v24.22.2-win-x64` (added to user PATH) |
| uv | 0.13.6 | `python -m pip install --user uv` (PyPI, Astral) | `%APPDATA%\Python\Python314\Scripts\uv.exe` (not on PATH) |
| typescript-language-server | 6.0.2 | `npm install -g typescript-language-server` | Node global prefix |
| TypeScript (global, for the LSP) | 6.0.3 | `npm install -g typescript@6` | Node global prefix |

Notes:
- `winget` (v1.2.10691) crashed with `0xC0000005` on every install, so Node and uv came
  from their official sources instead. Updating "App Installer" from the Microsoft Store should fix winget.
- Node 24 was chosen over Node 26 (LTS since 2026-10-28) because native-module prebuilds
  usually lag a brand-new ABI.
- `typescript@latest` is 7.0.2, the native port, which ships no `tsserver`. typescript-language-server 6
  needs `tsserver` (it targets TS ^6), so the global copy is pinned to 6.x. The project will have its own
  `typescript` devDependency, which the LSP prefers.
- User PATH entries added: the Node directory, `%APPDATA%\npm`, `%USERPROFILE%\.local\bin` (uv tools).
  **Restart the Claude desktop app** so its Claude Code process picks these up. Until then, the
  Ponytail hooks (`node`) and the Graphify hooks (`graphify`) can fail in already-running sessions.

## Configuration backup

Before any change: `%USERPROFILE%\.claude\backups\pre-desktop-assistant-20261029-123855\`
containing `settings.json`, `known_marketplaces.json`, `claude.json` (copy of `~/.claude.json`), `gitconfig`.

## Configuration changes

| File | Change |
|---|---|
| `~/.claude/settings.json` | `extraKnownMarketplaces.ponytail` added (by `claude plugin marketplace add`). The `addy-agent-skills` marketplace was added, then removed once the per-skill route was chosen. Auth and model settings were not touched. |
| `.claude/settings.json` (project) | `enabledPlugins` for ponytail, frontend-design, context7, typescript-lsp. Graphify `PreToolUse` hooks (`graphify hook-guard search` on `Bash\|Grep`, `graphify hook-guard read` on `Read\|Glob`). |
| `.claude/skills/` | `graphify` + 10 agent-skills |
| `.claude/references/` | 5 shared agent-skills checklists + MIT license copy |
| `.claude/CLAUDE.md`, `CLAUDE.md` | Graphify instructions (merged into the project CLAUDE.md) |
| `skills-lock.json` | Written by the skills CLI; pins source + content hash per skill |

---

## A. Ponytail

- **Repository:** https://github.com/dietrichgebert/ponytail (canonical casing `DietrichGebert/ponytail`)
- **License:** MIT (verified in `LICENSE`)
- **What it is:** A Claude Code **plugin**: one prompt (`skills/ponytail/SKILL.md`) pushing the
  agent toward the minimum code that works (reuse first, stdlib first, a test for risky logic), plus
  skills `/ponytail-review`, `/ponytail-audit`, `/ponytail-debt`, `/ponytail-gain`, `/ponytail-help`,
  three Node lifecycle hooks (SessionStart, SubagentStart, UserPromptSubmit) and a "band" UI module
  showing per-task cost/tokens/tests above the prompt.
- **Install method (documented):** `/plugin marketplace add DietrichGebert/ponytail` then
  `/plugin install ponytail@ponytail`. Equivalent CLI used:
  ```
  claude plugin marketplace add https://github.com/DietrichGebert/ponytail.git
  claude plugin install ponytail@ponytail --scope project
  ```
- **Installed version:** 5.3.3 (repo HEAD `7801d06`, 2026-10-29)
- **Configuration location:** `.claude/settings.json` → `enabledPlugins`; plugin cache
  `~/.claude/plugins/cache/ponytail/ponytail/5.3.3`; band ledger `~/.config/ponytail/band/`.
- **Requirements:** `node` on PATH (hooks), Claude Code ≥ 2.1.290 for the band.
- **Verification:** `claude plugin list` shows it enabled (project scope). `claude plugin details`
  reports ~430 tokens always-on. Ran `hooks/ponytail-activate.js` with Node 24: printed
  `PONYTAIL MODE ACTIVE — level: full`.
- **Permissions / security review:** Hooks read the project file list (`git ls-files` or a
  directory walk) and write CSV rows locally. The only network path is an **optional webhook**
  (`webhookUrl`, empty by default); the token is stored in the keychain. Left at defaults: ledger
  on, no webhook.
- **Remaining setup:** Restart the desktop app (Node on PATH). Optional: `/plugin configure ponytail@ponytail`.
- **Known limitations:** The SessionStart hook also injects its ruleset (~1k tokens) as context.
  Its "write less" stance can pull against `frontend-design`'s "distinctive, polished UI" stance;
  CLAUDE.md says which wins (UI polish for character/chat surfaces, minimalism everywhere else).
  The band is not shown in `claude -p` or cloud sessions.

## B. OmniRoute

- **Repository:** https://github.com/ChrisCompton/omniroute, a **fork** of
  `diegosouzapw/OmniRoute` (the LICENSE copyright and npm package name `omniroute` belong to
  upstream). The fork's HEAD is `515674b` / v3.6.1, 2026-04-10, about 6 months behind upstream activity.
- **License:** MIT
- **What it actually is:** A self-hosted **AI API gateway** (Next.js server + optional Electron
  dashboard, port 20128) exposing an OpenAI-compatible `/v1` endpoint. It routes each request
  across 60+ providers with a 4-tier fallback (subscription → API key → cheap → free), plus an MCP
  server, A2A protocol, quota tracking, and format translation. It is **not** a Claude Code plugin
  or skill. Claude Code would use it by pointing `ANTHROPIC_BASE_URL` (or the dashboard's
  "one-click" edit of `~/.claude/settings.json`) at the proxy.
- **Authentication model:** Each provider is connected in its dashboard by API key or OAuth.
  The README's "Claude Code (Pro/Max)" provider performs an **OAuth login with your Claude
  subscription** and re-serves those tokens to *other* tools through the proxy, with automatic
  token refresh and **multi-account round-robin**. It also advertises routing OAuth through the
  proxy to get around regional blocks, and "unlimited" Claude via a third-party (Kiro) account.
- **Why it was not installed:**
  1. Using Claude Pro OAuth tokens outside Claude Code / claude.ai, and pooling accounts to
     stretch quota, conflicts with your rules against bypassing provider authentication, usage
     limits or access controls, and with Anthropic's position that claude.ai login is not to be
     offered through third-party products (see the Agent SDK overview).
  2. Pointing Claude Code at the proxy would replace your working subscription auth path. That is
     the auth/model change you told me not to make without explicit approval.
  3. It is a large, fast-moving server (Next.js, SQLite, OAuth token store) that would hold every
     provider credential in one local database. That is a high-value target for a dev convenience.
  4. The requested repo is a stale fork, not the maintained upstream.
- **What a compliant use could look like (needs your approval):** Run upstream OmniRoute
  **only** with provider API keys you own (no subscription OAuth, no multi-account pooling,
  no region workarounds), bound to `127.0.0.1`, and point **only the desktop assistant's own
  OpenAI-compatible provider** at it, never Claude Code. Since our app already needs a provider
  abstraction, this adds a process without new capability, so the recommendation is **don't
  install**.
- **Exact commands, if you approve the API-key-only variant:**
  ```
  npm install -g omniroute
  omniroute --no-open        # dashboard + API on http://localhost:20128
  ```
  Then add only API-key providers in the dashboard, and in this app's settings choose
  "OpenAI-compatible" with base URL `http://localhost:20128/v1`. Do **not** use its CLI-Tools page
  to rewrite `~/.claude/settings.json`.
- **Verification performed:** Source inspection only (README, package.json, LICENSE, git log).
  Nothing executed.

## C. Graphify

- **Repository:** https://github.com/Graphify-Labs/graphify (README names it the official source;
  PyPI package is `graphifyy`, double-y. Other `graphify*` packages are unaffiliated.)
- **License:** Apache-2.0 (`LICENSE`, `NOTICE`), with an additional `LICENSE-MIT` file
- **What it is:** A CLI plus assistant skill that builds a **knowledge graph** of the repo:
  tree-sitter AST extraction (~40 languages, local, no LLM), cross-file `calls`/`imports`/`inherits`
  edges, Leiden communities, "god nodes", `graphify query|path|explain`, and `GRAPH_REPORT.md`.
  Docs/PDFs/images go through an LLM only when a backend is configured.
- **Install method (documented):**
  ```
  uv tool install graphifyy          # used: --python <system 3.14>, see below
  graphify install --project --platform windows
  ```
- **Installed version:** graphifyy 0.9.97 (repo HEAD `0a8cd4e`, 2026-10-27), Python 3.14.10 venv
  under uv tools. Executables: `%USERPROFILE%\.local\bin\graphify.exe`, `graphify-mcp.exe`.
- **Configuration location:** `.claude/skills/graphify/`, `.claude/settings.json` (`PreToolUse`
  hooks), `.claude/CLAUDE.md`, the `## graphify` section in `CLAUDE.md`. Graph output goes to
  `graphify-out/` once built.
- **Verification:** `graphify --version` → 0.9.97. `graphify hook-guard search` with a sample
  hook payload exited 0 (silent, because no graph exists yet).
- **Permissions / privacy:** Code parsing is local. No telemetry, per the README. Query log at
  `~/.cache/graphify-queries.log`. Set `GRAPHIFY_QUERY_LOG_DISABLE=1` to opt out. Its hooks
  only add guidance before Read/Glob/Grep/Bash. Strict mode (blocking reads) is **not** enabled.
- **Remaining setup:** Restart the desktop app (PATH). Once source code exists, run `/graphify .`
  (or `graphify update .`, which is AST-only and free) to build the first graph. Optionally put
  `%APPDATA%\Python\Python314\Scripts` on PATH to call `uv` directly for upgrades
  (`uv tool upgrade graphifyy`).
- **Known limitations:** `uv tool install --python 3.12` failed (uv could not create its managed
  Python link: "Missing expected target directory for Python minor version link"), so the
  system Python 3.14 is used. Cloning the repo on Windows hits "Filename too long" for test
  fixtures (irrelevant to the installed package). The graph has no value until there is code,
  i.e. from Milestone 1.

## D. Addy Osmani Agent Skills

- **Repository:** https://github.com/addyosmani/agent-skills (HEAD `eb07f19`, v0.6.14, 2026-10-28)
- **License:** MIT (copy kept at `.claude/references/LICENSE-addyosmani-agent-skills.txt`)
- **What it is:** 25 SDLC skills (spec → plan → build → verify → review → ship), 9 slash
  commands, 4 agent personas, shared checklists. Also published as a Claude Code plugin
  (`agent-skills@addy-agent-skills`).
- **Install method chosen:** the README's documented per-skill route (skills CLI, MIT,
  `vercel-labs/skills` 1.7.4), with telemetry disabled:
  ```
  DISABLE_TELEMETRY=1 DO_NOT_TRACK=1 npx -y skills@1.7.4 add https://github.com/addyosmani/agent-skills \
    -a claude-code --copy -y -s <skill> [-s <skill> …]
  ```
  The README warns that per-skill installs omit the repo-level `references/`. The 5 checklists
  the installed skills cite (`../../references/*.md`) were copied to `.claude/references/`.
- **Why not the whole plugin:** It loads all 25 skill descriptions, 9 commands and 4 agents every
  session (an estimated 2.5–3k tokens always-on). Several overlap Ponytail, built-in `/code-review`
  and `/simplify`, and plan mode.
- **Installed (10):**

  | Skill | Why |
  |---|---|
  | `frontend-ui-engineering` | Character/chat/settings UI, accessibility |
  | `api-and-interface-design` | IPC contracts, provider and plugin interfaces |
  | `code-review-and-quality` | Code quality gate (five-axis review) |
  | `test-driven-development` | State machine, permission broker, providers need tests first |
  | `debugging-and-error-recovery` | Structured debugging |
  | `performance-optimization` | Idle GPU/CPU budget of an always-on 3D window |
  | `browser-testing-with-devtools` | Renderer verification via DevTools |
  | `documentation-and-adrs` | Keeps `docs/DECISIONS.md` honest |
  | `security-and-hardening` | Electron hardening, tool permissions, secrets |
  | `incremental-implementation` | Milestone-by-milestone delivery |

- **Not installed (15):** idea-refine, interview-me, spec-driven-development,
  planning-and-task-breakdown, context-engineering, source-driven-development (Context7 covers
  this), doubt-driven-development, constraint-driven-development, code-simplification (Ponytail +
  `/simplify`), git-workflow-and-versioning, ci-cd-and-automation, deprecation-and-migration,
  observability-and-instrumentation, shipping-and-launch, using-agent-skills. Consider
  `ci-cd-and-automation` and `shipping-and-launch` at Milestone 9.
- **Configuration location:** `.claude/skills/<name>/`, `.claude/references/`, `skills-lock.json`.
- **Verification:** All 10 directories exist with `SKILL.md`. Lockfile hashes recorded.
  Checklist paths resolve.
- **Remaining setup:** None. Update with `npx skills update -p`.
- **Known limitations:** The skills run with full agent permissions (the CLI says so too). They are
  instructions, not code. The `security-and-hardening` and `frontend-ui-engineering` skills mention
  shell hooks that were **not** installed.

---

## Additional plugins (official marketplace `claude-plugins-official`)

| Plugin | Decision | Reason / verification |
|---|---|---|
| `frontend-design` 1.1.1 | Installed (project) | High-quality UI direction for chat/settings/onboarding |
| `context7` (`f8c5e7a1dcb7`) | Installed (project) | Remote HTTP MCP `https://mcp.context7.com/mcp`, version-matched library docs (Electron, three-vrm, MCP SDK). `claude mcp list` → **"Needs authentication"**: run `/mcp` → context7 → authenticate, or set `CONTEXT7_API_KEY`. Not done for you (credentials). |
| `typescript-lsp` 1.0.0 | Installed (project) | Needs `typescript-language-server` on PATH (installed). A JSON-RPC `initialize` handshake succeeded. |
| `code-review` | Skipped | Claude Code 2.1.308 already has a built-in `/code-review` (effort levels, `--fix`, ultra), and Ponytail adds `/ponytail-review`. |
| `code-simplifier` | Skipped | Built-in `/simplify` + Ponytail cover it. |
| `superpowers` (obra/superpowers @ `bb92a77`) | Skipped, available on request | Its TDD, systematic debugging and planning duplicate the installed agent-skills. It also injects a session-start bootstrap prompt that competes with Ponytail. Install with `claude plugin install superpowers@claude-plugins-official --scope project` if you prefer it over the agent-skills set. |
| `playwright` (MCP) | Deferred | Electron E2E will use `@playwright/test`'s `_electron` API in-repo. The Claude desktop app's built-in browser pane covers ad-hoc page checks. Revisit at Milestone 7 for the runtime browser integration. |

## Model routing for this project

- This session runs **Opus 5.5** (`claude-opus-5-5`) on your account, so Opus is available.
  Sonnet 5.5 (`claude-sonnet-5-5`) is the routine-implementation model.
- Suggested use: Opus for architecture, security design and hard debugging; Sonnet for
  routine implementation and tests. Switch with the app's model picker or `/model`.
  The `opusplan` alias (Opus in plan mode, Sonnet otherwise) matches this split.
- No model or auth configuration was changed. Claude Pro does **not** include Claude API access.
  An Anthropic API key (Console, separate billing) is needed for the app's own Anthropic provider
  and for the Agent SDK.
