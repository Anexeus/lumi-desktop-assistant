# Installation

## Install Lumi (end users)

1. Build the installer with `npm run package` (or take `Lumi Setup 0.1.0.exe` from a release). It is not code-signed yet, so
   Windows SmartScreen asks: "More info" → "Run anyway". It installs per user; no admin rights needed.
2. Install Ollama and the models (below). Lumi starts Ollama by itself if it is installed but not running.
3. Optional: Settings → Tools to approve folders and apps, Settings → Integrations for GitHub and MCP servers,
   Settings → Claude Code for task notifications.

Uninstall from Windows Settings → Apps. Your chats, memories and settings stay in `%APPDATA%\Desktop Assistant`;
delete that folder to remove them (or use Settings → Memory → "Delete all my data…" first).

### Troubleshooting (app)
- "Can't reach the AI": install Ollama, or start it from the Start menu.
- Claude Code tasks fail with "not logged in": open a terminal, run `claude`, type /login.
- "The notification port is busy": another program uses port 47821; restart Lumi after closing it.
- Lumi refuses to start with `--remote-debugging-port`: that is intentional in installed builds.

## Development environment (set up on 2026-10-29)

## Prerequisites

| Tool | Version | Source |
|---|---|---|
| Windows | 10/11 x64 | |
| Node.js | 24 LTS (24.22.2 verified) | https://nodejs.org (zip + `SHASUMS256.txt`, or the MSI) |
| Git | any recent (2.56 verified) | https://git-scm.com |
| Claude Code | 2.1.308 verified | Claude desktop app or `npm i -g @anthropic-ai/claude-code` |
| Python 3.10+ and uv | for Graphify only | python.org; `python -m pip install --user uv` |

## Local AI (Ollama)

1. Install Ollama from https://ollama.com/download (verified here: `OllamaSetup.exe` 0.40.13, signed by Ollama Inc.).
   It installs per user and starts a local server on `http://127.0.0.1:11434`.
2. Pull the default model (2.5 GB):

```
ollama pull qwen3:4b
```

3. For voice (speaking and push-to-talk), pull the audio model (1.7 GB):

```
ollama pull lfm3-audio
```

4. In the app: Settings → AI → "Use Ollama on this PC" → Test connection, and Settings → Voice → Test voice.

If chat says it can't reach the AI, start Ollama from the Start menu (closing its window can stop it).

Smaller GPUs or no GPU: try `qwen3:1.7b`. Bigger GPUs: `qwen3:8b`. Any OpenAI-compatible endpoint works too
(LM Studio, Groq, Gemini, OpenRouter): paste its `/v1` address and an API key.

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
