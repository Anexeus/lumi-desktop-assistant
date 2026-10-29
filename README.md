# Desktop Assistant

A Windows desktop AI companion: an animated VRM character in a transparent, always-on-top
window that talks by voice and text, helps with everyday computer tasks through permissioned
tools, and works alongside Claude Code.

**Status:** Milestone 3 done: an animated VRM character you can chat with, powered by a free local model
(Ollama + qwen3:4b) or any OpenAI-compatible service, plus a quick-ask "island" bar at the top of the screen. See [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md).

## Run it

Requires Node 24 on Windows.

```
npm install
npm run dev
```

For AI, install [Ollama](https://ollama.com) and run `ollama pull qwen3:4b` (see [docs/INSTALLATION.md](docs/INSTALLATION.md)).

`Control+Alt+Shift+A` shows or hides the character, and `Alt+Shift+Space` opens the island. The tray icon has the rest.
Tests: `npm test` (unit) and `npm run test:e2e` (Electron). `npm run package:dir` builds an unpacked app in `release/`.

## Docs

- [Architecture](docs/ARCHITECTURE.md): Electron + React + three-vrm, sandboxed renderers, privileged main
- [Roadmap](docs/ROADMAP.md): milestones 0–9 and the Milestone 1 plan
- [Security](docs/SECURITY.md)
- [Decisions](docs/DECISIONS.md)
- [Plugin registry](docs/PLUGIN_REGISTRY.md): runtime plugins and permissions
- [Reference research](docs/REFERENCE_RESEARCH.md): AIRI, Xiaoke AI, YUI and others
- [Development tools](docs/DEVELOPMENT_TOOLS.md): Claude Code plugins/skills and how they were verified
- [Installation](docs/INSTALLATION.md)
