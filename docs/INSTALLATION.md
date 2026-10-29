# Installation

The application does not exist yet. This page covers the **development environment** as
set up on 2026-10-29. End-user install steps arrive in Milestone 9.

## Prerequisites

| Tool | Version | Source |
|---|---|---|
| Windows | 10/11 x64 | |
| Node.js | 24 LTS (24.22.2 verified) | https://nodejs.org (zip + `SHASUMS256.txt`, or the MSI) |
| Git | any recent (2.56 verified) | https://git-scm.com |
| Claude Code | 2.1.308 verified | Claude desktop app or `npm i -g @anthropic-ai/claude-code` |
| Python 3.10+ and uv | for Graphify only | python.org; `python -m pip install --user uv` |

## Claude Code tooling (reproduce on another machine)

From the project folder:

```
claude plugin marketplace add https://github.com/DietrichGebert/ponytail.git
```
The project `.claude/settings.json` already lists the enabled plugins. To install them explicitly:
```
claude plugin install ponytail@ponytail --scope project
claude plugin install frontend-design@claude-plugins-official --scope project
claude plugin install context7@claude-plugins-official --scope project
claude plugin install typescript-lsp@claude-plugins-official --scope project
npm install -g typescript-language-server typescript@6
uv tool install graphifyy
```
The agent-skills and the Graphify skill are committed under `.claude/skills/`, and the
hashes are in `skills-lock.json`. Restore them with `npx skills experimental_install`.

## Troubleshooting

- `node: command not found` from hooks: Node is not on the PATH Claude Code inherited. Restart the desktop app.
- `graphify` not found in hooks: add `%USERPROFILE%\.local\bin` to PATH (`uv tool update-shell`), then restart.
- Context7 "Needs authentication": `/mcp` → context7 → authenticate.
- Marketplace clone fails with `Permission denied (publickey)`: use the HTTPS URLs above.
