# Instructions for AI coding agents

Start with [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) (what Lumi is, layout, history, how to extend it), then
[README.md](README.md) (exact commands) and [CLAUDE.md](CLAUDE.md) (working rules and security invariants: they apply to
every agent, not only Claude Code).

Essentials: Windows only. Run commands from the project root (`package.json` is there); in PowerShell use `npm.cmd`.
Before saying something works, run `npm run typecheck`, `npm run lint`, `npm test` and `npm run test:e2e`. Never put keys
or the user's data into code, logs, tests or git. No general shell tool for the assistant; add specific tools instead.
