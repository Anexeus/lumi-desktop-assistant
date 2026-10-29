# Lumi (Desktop Assistant)

A Windows desktop AI companion: an animated VRM character in a transparent, always-on-top
window that talks by voice and text, helps with everyday computer tasks through permissioned
tools, and works alongside Claude Code.

**Status:** Milestones 0–9 done. **Lumi** is an animated VRM character that waves, gestures and talks back out loud, with a
liquid-glass chat, settings and quick-ask "island" at the top of the screen. Chat by typing or push-to-talk; it remembers what
you tell it (`/remember`). With your permission it can search and read your approved folders, open approved apps, read web
pages, use GitHub and MCP servers, and hand coding tasks to your Claude Code. Everything runs free and locally through Ollama
(qwen3:4b for chat, lfm3-audio for voice). Click the island to talk hands-free, pick from 5 characters with matching
voices, and say things like "open YouTube and search lofi". See [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md).

## Run it

Requires Node 24 on Windows.

```
npm install
npm run dev
```

For AI, install [Ollama](https://ollama.com) and run `ollama pull qwen3:4b` and `ollama pull lfm3-audio` (see [docs/INSTALLATION.md](docs/INSTALLATION.md)).

`Control+Alt+Shift+A` shows or hides the character, and `Alt+Shift+Space` opens the island. The tray icon has the rest.
Tests: `npm test` (unit) and `npm run test:e2e` (Electron). `npm run package` builds the installer in `release/`.

## Docs

- [Architecture](docs/ARCHITECTURE.md): Electron + React + three-vrm, sandboxed renderers, privileged main
- [Roadmap](docs/ROADMAP.md): milestones 0–9 and the Milestone 1 plan
- [Security](docs/SECURITY.md)
- [Decisions](docs/DECISIONS.md)
- [Plugin registry](docs/PLUGIN_REGISTRY.md): runtime plugins and permissions
- [Reference research](docs/REFERENCE_RESEARCH.md): AIRI, Xiaoke AI, YUI and others
- [Development tools](docs/DEVELOPMENT_TOOLS.md): Claude Code plugins/skills and how they were verified
- [Installation](docs/INSTALLATION.md)
