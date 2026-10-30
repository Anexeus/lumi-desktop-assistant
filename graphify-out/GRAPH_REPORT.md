# Graph Report - Desktop Assistant  (2026-10-30)

## Corpus Check
- 148 files · ~120,794 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 13 file(s) not represented in the graph (top: .css 5, .vrm 5, (none) 3)

## Summary
- 1538 nodes · 2708 edges · 97 communities (82 shown, 15 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 92 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2281387a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- security.ts
- devDependencies
- start
- Code Review and Quality
- Test-Driven Development
- Performance Checklist
- Optimization Patterns
- API and Interface Design
- Browser Testing with DevTools
- Frontend UI Engineering
- Hardening Controls
- Documentation and ADRs
- Incremental Implementation
- Debugging and Error Recovery
- ai.spec.ts
- electron-builder.yml
- Security Checklist
- avatar.ts
- compilerOptions
- Accessibility Checklist
- compilerOptions
- Settings.tsx
- Testing Patterns Reference (JavaScript/TypeScript)
- Decisions (ADR log)
- main.ts
- compilerOptions
- The Standing Checklist
- Development Tools
- README.md
- scripts
- Security
- Current State
- Reference Research
- shared/ipc.ts
- Desktop Assistant: instructions for Claude Code
- Installation
- tsconfig.json
- .claude/CLAUDE.md
- package.json
- Application Plugin Registry (design)
- eslint.config.mjs
- electron.vite.config.ts
- Third-party notices
- conversation.ts
- web.ts
- tools.test.ts
- tasks.ts
- commands.ts
- hooks.ts
- ref_node_path
- settings.ts
- main/index.ts
- tray.ts
- @playwright/test
- mcp.ts
- AssistantApi
- vitest
- store.ts
- preload/index.ts
- @modelcontextprotocol/sdk
- local.ts
- fake-claude.mjs
- ToolsSettings.tsx
- electron-builder@26.18.0
- @types/react@19.3.0
- geometry.ts
- provider.ts
- schemas.ts
- desktop.ts
- useVoiceMode.ts
- desktop.ps1
- shortcuts.ts
- Upgrade progress (2026-10-30 brief: repair, computer use, voice, local AI, UI, installer)
- windows.ts
- projects.ts
- main.ts
- AiSettings.tsx
- Island.tsx
- CharacterScene
- voice.ts
- Avatar
- character.ts
- OTHERAGENT.md — the whole story of Lumi, for the next AI
- main/ipc.ts
- RichText.tsx
- 4. The story, in order
- app.spec.ts
- scene.ts
- AppState
- window-state.ts
- Lumi — project summary and handoff
- Frame
- Lumi (Desktop Assistant)
- aiConfig
- Perch
- @pixiv/three-vrm
- vite@8.3.5

## God Nodes (most connected - your core abstractions)
1. `start()` - 105 edges
2. `Decisions (ADR log)` - 56 edges
3. `WindowManager` - 33 edges
4. `vitest` - 26 edges
5. `tool` - 25 edges
6. `Current State` - 23 edges
7. `react` - 20 edges
8. `Code Review and Quality` - 19 edges
9. `ProviderError` - 18 edges
10. `AssistantApi` - 18 edges

## Surprising Connections (you probably didn't know these)
- `Character state machine (pure TS, renderer)` --references--> `notify()`  [INFERRED]
  docs/ARCHITECTURE.md → src/main/index.ts
- `Stack and commands` --references--> `PermissionBroker`  [INFERRED]
  CLAUDE.md → src/main/tools/broker.ts
- `ADR-015 Character state machine lives in main (2026-10-29)` --references--> `AppState`  [INFERRED]
  docs/DECISIONS.md → src/shared/ipc.ts
- `5. Decisions worth knowing (see docs/DECISIONS.md)` --references--> `AppState`  [INFERRED]
  OTHERAGENT.md → src/shared/ipc.ts
- `Phase 14: mouse-wheel resize (done first: smallest, self-contained)` --references--> `scaleBounds()`  [INFERRED]
  docs/UPGRADE_PROGRESS.md → src/main/geometry.ts

## Import Cycles
- None detected.

## Communities (97 total, 15 thin omitted)

### Community 0 - "security.ts"
Cohesion: 0.27
Nodes (11): APP_HOST, APP_SCHEME, devCsp(), isTrustedUrl(), PROD_CSP, resolveBundlePath(), hardenSession(), hardenWebContents() (+3 more)

### Community 1 - "devDependencies"
Cohesion: 0.13
Nodes (15): devDependencies, electron@45.1.0, eslint@10.13.0, @ghostery/adblocker@2.20.1, react@19.3.1, react-dom@19.3.1, three@0.186.1, @types/react-dom@19.3.0 (+7 more)

### Community 2 - "start"
Cohesion: 0.13
Nodes (13): Rect, start(), emergencyStop(), fire(), notify(), previewMenu(), setState(), showPanel() (+5 more)

### Community 3 - "Code Review and Quality"
Cohesion: 0.06
Nodes (30): 1. Correctness, 2. Readability & Simplicity, 3. Architecture, 4. Security, 5. Performance, Change Descriptions, Change Sizing, Code Review and Quality (+22 more)

### Community 4 - "Test-Driven Development"
Cohesion: 0.07
Nodes (29): Browser Testing with DevTools, Common Rationalizations, DAMP Over DRY in Tests, Decision Guide, Discover the Stack First, Name Tests Descriptively, One Assertion Per Concept, Overview (+21 more)

### Community 5 - "Performance Checklist"
Cohesion: 0.07
Nodes (26): API, Backend Checklist, Cache checklist, Caching Strategies, Common Anti-Patterns, Connection pooling, Core Web Vitals Targets, CSS (+18 more)

### Community 6 - "Optimization Patterns"
Cohesion: 0.07
Nodes (25): Connection Pool Exhaustion, Large Bundle Size, Missing Caching (Backend), Missing Image Optimization (Frontend), N+1 Queries (Backend), Optimization Patterns, Queries That Ignore Their Index, Unbounded Data Fetching (+17 more)

### Community 7 - "API and Interface Design"
Cohesion: 0.08
Nodes (24): 1. Contract First, 2. Consistent Error Semantics, 3. Validate at Boundaries, 4. Prefer Addition Over Modification, 5. Predictable Naming, 6. Honouring an Idempotency Key, API and Interface Design, Common Rationalizations (+16 more)

### Community 8 - "Browser Testing with DevTools"
Cohesion: 0.08
Nodes (24): Accessibility Verification with DevTools, Available Tools, Browser Testing with DevTools, Clean Console Standard, Common Rationalizations, Console Analysis Patterns, Content Boundary Markers, For Network Issues (+16 more)

### Community 9 - "Frontend UI Engineering"
Cohesion: 0.08
Nodes (24): Accessibility (WCAG 2.1 AA), ARIA Labels, Avoid the AI Aesthetic, Color, Common Rationalizations, Component Architecture, Component Patterns, Design System Adherence (+16 more)

### Community 10 - "Hardening Controls"
Cohesion: 0.05
Nodes (42): Broken Access Control, Broken Authentication, Cross-Site Scripting (XSS), Data Classification, Dependency Audit Triage, Destructive Operations on Derived Paths, File Upload Safety, Hardening Patterns (+34 more)

### Community 11 - "Documentation and ADRs"
Cohesion: 0.09
Nodes (22): ADR Lifecycle, ADR Template, API Documentation, Architecture Decision Records (ADRs), Changelog Maintenance, Common Rationalizations, Document Known Gotchas, Documentation and ADRs (+14 more)

### Community 12 - "Incremental Implementation"
Cohesion: 0.09
Nodes (22): Common Rationalizations, Contract-First Slicing, Implementation Rules, Increment Checklist, Incremental Implementation, Overview, Red Flags, Risk-First Slicing (+14 more)

### Community 13 - "Debugging and Error Recovery"
Cohesion: 0.09
Nodes (21): Build Failure Triage, Common Rationalizations, Debugging and Error Recovery, Error-Specific Patterns, Instrumentation Guidelines, Overview, Red Flags, Runtime Error Triage (+13 more)

### Community 14 - "ai.spec.ts"
Cohesion: 0.11
Nodes (15): characterState(), fakeMicWav(), launch(), openPanel(), page(), pageErrors, pages(), requests (+7 more)

### Community 15 - "electron-builder.yml"
Cohesion: 0.08
Nodes (24): appId, asar, directories, output, electronFuses, enableCookieEncryption, enableEmbeddedAsarIntegrityValidation, enableNodeCliInspectArguments (+16 more)

### Community 16 - "Security Checklist"
Cohesion: 0.11
Nodes (17): AI / LLM Security, Authentication, Authorization, CORS Configuration, Data Protection, Dependency Security, Destructive Path Operations, Error Handling (+9 more)

### Community 17 - "avatar.ts"
Cohesion: 0.29
Nodes (10): Pose, POSES, VISEMES, envelope(), GESTURE_SECONDS, gestureOffsets(), IDLE_GESTURES, Offsets (+2 more)

### Community 18 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, composite, esModuleInterop, isolatedModules, lib, module, moduleResolution, noEmit (+9 more)

### Community 19 - "Accessibility Checklist"
Cohesion: 0.12
Nodes (16): Accessibility Checklist, Accessible Lists, ARIA Roles, Buttons vs. Links, Common Anti-Patterns, Common HTML Patterns, Content, Essential Checks (+8 more)

### Community 20 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, composite, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+8 more)

### Community 21 - "Settings.tsx"
Cohesion: 0.12
Nodes (20): react, Approvals(), Chat(), onKeyDown(), send(), ClaudeSettings(), IntegrationsSettings(), PRESETS (+12 more)

### Community 22 - "Testing Patterns Reference (JavaScript/TypeScript)"
Cohesion: 0.14
Nodes (13): API / Integration Testing, Common Assertions, E2E Testing (Playwright), Mock at Boundaries Only, Mock Functions, Mock Modules, Mocking Patterns, React/Component Testing (+5 more)

### Community 23 - "Decisions (ADR log)"
Cohesion: 0.04
Nodes (54): ADR-001 Electron over Tauri (2026-10-29), ADR-002 React instead of Vue (2026-10-29), ADR-003 No Python backend (2026-10-29), ADR-004 Privileged work only in main; sandboxed renderers (2026-10-29), ADR-005 OmniRoute not adopted (2026-10-29), ADR-006 Claude Code via hooks + headless CLI (2026-10-29), ADR-007 SQLite driver: `node:sqlite` (decided 2026-10-29), ADR-008 Agent-skills subset instead of full plugin (2026-10-29) (+46 more)

### Community 24 - "main.ts"
Cohesion: 0.22
Nodes (16): createSpeaker(), enqueue(), finishIfDone(), playWav(), pump(), speakWithWindows(), Sentence, mouthLevel() (+8 more)

### Community 25 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, lib, module, moduleResolution, noEmit, paths, skipLibCheck, strict (+4 more)

### Community 26 - "The Standing Checklist"
Cohesion: 0.18
Nodes (10): Correctness, Definition of Done, Definition of Done vs. Acceptance Criteria, Documentation, How to Apply, Integration, Quality, Red Flags (+2 more)

### Community 27 - "Development Tools"
Cohesion: 0.17
Nodes (11): A. Ponytail, Additional plugins (official marketplace `claude-plugins-official`), B. OmniRoute, C. Graphify, Configuration backup, Configuration changes, D. Addy Osmani Agent Skills, Development Tools (+3 more)

### Community 28 - "README.md"
Cohesion: 0.27
Nodes (3): Instructions for AI coding agents, Milestone 1 plan (implemented 2026-10-29; kept for reference), Roadmap

### Community 29 - "scripts"
Cohesion: 0.18
Nodes (11): scripts, build, dev, lint, package, package:dir, preview, runtimes (+3 more)

### Community 30 - "Security"
Cohesion: 0.12
Nodes (15): Claude Code, Dependency policy, Desktop control, project scripts, local engines, Development-tool risks (this repo), Electron baseline (enforced from Milestone 1), MCP, Microphone and voice (Milestone 4), PC actions (+7 more)

### Community 31 - "Current State"
Cohesion: 0.08
Nodes (23): Bugs found and fixed while testing (Milestone 1), Bugs found and fixed while testing (Milestone 2), Current State, Findings while testing (Milestone 3), Findings while testing (Milestones 4–5), Findings while testing (Milestones 6–9), Known issues / follow-ups, Livelier character (new) (+15 more)

### Community 32 - "Reference Research"
Cohesion: 0.25
Nodes (7): 1. AIRI (moeru-ai/airi): primary reference, 2. Xiaoke AI (liupig/xiaokeai), 3. YUI (yw0nam/YUI): ideas only (noncommercial license), Cross-cutting conclusions, Licensing summary (read first), Reference Research, Snapshot

### Community 33 - "shared/ipc.ts"
Cohesion: 0.04
Nodes (11): AiSettings, AiStatus, ChooseModelResult, ClaudeState, ListModelsResult, LocalState, ModelInfo, PluginInfo (+3 more)

### Community 34 - "Desktop Assistant: instructions for Claude Code"
Cohesion: 0.33
Nodes (6): Assets and licenses, Desktop Assistant: instructions for Claude Code, graphify, Security invariants (do not weaken), Stack and commands, Working rules

### Community 35 - "Installation"
Cohesion: 0.22
Nodes (8): Claude Code tooling (reproduce on another machine), Development environment (set up on 2026-10-29), Install Lumi (end users), Installation, Local AI (Ollama), Prerequisites, Troubleshooting, Troubleshooting (app)

### Community 38 - "package.json"
Cohesion: 0.14
Nodes (13): dependencies, zod@4.6.7, description, @types/node@24.19.2, engines, node, license, main (+5 more)

### Community 39 - "Application Plugin Registry (design)"
Cohesion: 0.33
Nodes (5): Application Plugin Registry (design), Enforcement, Lifecycle, Manifest, Scope (v1)

### Community 40 - "eslint.config.mjs"
Cohesion: 0.29
Nodes (6): @eslint/js@10.0.1, globals@17.13.0, typescript-eslint@8.72.1, @eslint/js, globals, typescript-eslint

### Community 41 - "electron.vite.config.ts"
Cohesion: 0.33
Nodes (5): shared, electron-vite@6.0.0, @vitejs/plugin-react@6.1.2, electron-vite, @vitejs/plugin-react

### Community 42 - "Third-party notices"
Cohesion: 0.40
Nodes (4): Claude Code skills (development only, not shipped), npm packages, Seed-san (default character model), Third-party notices

### Community 43 - "conversation.ts"
Cohesion: 0.11
Nodes (12): Conversation, ConversationDeps, parseWrittenToolCall(), systemPrompt(), wrapToolResult(), ChatMessage, CharacterEvent, ChatItem (+4 more)

### Community 44 - "web.ts"
Cohesion: 0.13
Nodes (12): blockAds(), browser(), browserContents, downloadName(), lenientItem(), load(), openArgs, openInput (+4 more)

### Community 45 - "tools.test.ts"
Cohesion: 0.10
Nodes (20): zod, ToolCall, ToolSpec, DEBUG_SWITCHES, locked, PermissionBroker, resolve(), githubPlugin() (+12 more)

### Community 46 - "tasks.ts"
Cohesion: 0.17
Nodes (9): Planned built-ins, ClaudeTasks, describeEvent(), explainFailure(), findClaude(), TaskRunnerDeps, ClaudeTask, fake (+1 more)

### Community 47 - "commands.ts"
Cohesion: 0.27
Nodes (8): HELP, MAX_MEMORY_CHARS, runCommand(), saveMemory(), looksSensitive(), luhn(), PATTERNS, SaveResult

### Community 48 - "hooks.ts"
Cohesion: 0.17
Nodes (14): ClaudeSettings, EVENTS, eventSchema, HOOK_PORT, hookCommand(), HookEntry, HookEvent, hooksInstalled() (+6 more)

### Community 49 - "ref_node_path"
Cohesion: 0.19
Nodes (11): appsPlugin(), filesPlugin(), findApp(), noteFileName(), systemApps(), writePlugin(), createScopedFiles(), SearchHit (+3 more)

### Community 50 - "settings.ts"
Cohesion: 0.13
Nodes (21): DEFAULT_AI, DEFAULT_LOCAL, DEFAULT_NAME, DEFAULT_TOOLS, DEFAULT_VOICE, getSecret(), hasSecret(), isLocalUrl() (+13 more)

### Community 51 - "main/index.ts"
Cohesion: 0.10
Nodes (21): Architecture, Character state machine (pure TS, renderer), Claude Code bridge, Conversation engine (main), Key modules, Memory, Plugin registry, tools, permissions, Repository layout (from Milestone 1) (+13 more)

### Community 52 - "tray.ts"
Cohesion: 0.17
Nodes (7): electron, appIcon(), notifyPlugin(), createTray(), menuTemplate(), TrayActions, formatAccelerator()

### Community 54 - "mcp.ts"
Cohesion: 0.23
Nodes (8): Connection, McpManager, McpToolInfo, mcpToolName(), parseCommandLine(), slug(), McpServerConfig, McpServerInfo

### Community 56 - "vitest"
Cohesion: 0.28
Nodes (4): vitest@5.0.5, vitest, redact(), startLog()

### Community 57 - "store.ts"
Cohesion: 0.23
Nodes (10): createStore(), MIGRATIONS, openStore(), StoredMessage, MemorySettings(), add(), when(), ConversationSummary (+2 more)

### Community 58 - "preload/index.ts"
Cohesion: 0.50
Nodes (3): api, ChatEvent, Events

### Community 59 - "@modelcontextprotocol/sdk"
Cohesion: 0.50
Nodes (3): @modelcontextprotocol/sdk@1.32.2, @modelcontextprotocol/sdk, server

### Community 60 - "local.ts"
Cohesion: 0.10
Nodes (15): root, RUNTIMES, downloadModel(), freePort(), listDevices(), LocalServer, pickDevice(), sha256File() (+7 more)

### Community 65 - "geometry.ts"
Cohesion: 0.15
Nodes (21): ADR-054 Peeking from screen edges and sitting on app windows (2026-10-30), ADR-055 Settings are validated one by one (2026-10-30), Phase 14: mouse-wheel resize (done first: smallest, self-contained), 4.8 This round → 0.4.0, canSit(), CHARACTER_DEFAULT, CHARACTER_MAX, CHARACTER_MIN (+13 more)

### Community 66 - "provider.ts"
Cohesion: 0.19
Nodes (15): createThinkFilter(), describeHttpError(), describeImage(), endpoint(), headers(), listModels(), ProviderConfig, ProviderError (+7 more)

### Community 67 - "schemas.ts"
Cohesion: 0.10
Nodes (20): CHARACTER_IDS, CHARACTERS, findCharacter(), acceleratorSchema, aiSettingsSchema, assistantNameSchema, baseUrlSchema, boundsSchema (+12 more)

### Community 68 - "desktop.ts"
Cohesion: 0.14
Nodes (11): describeLook(), DesktopHelper, desktopPlugin(), Element, Look, Rect, rectText(), target (+3 more)

### Community 69 - "useVoiceMode.ts"
Cohesion: 0.23
Nodes (12): MicButton(), RecorderStatus, useRecorder(), useVoiceMode(), VAD, vadInit(), VadState, vadStep() (+4 more)

### Community 70 - "desktop.ps1"
Cohesion: 0.33
Nodes (15): Act(), Await(), Capture(), Click(), Elements(), EnsureTarget(), FindWindow(), Handle() (+7 more)

### Community 71 - "shortcuts.ts"
Cohesion: 0.17
Nodes (13): ShortcutRow(), onKeyDown(), save(), Invoke, Send, sendSchemas, DEFAULT_SHORTCUTS, isAccelerator() (+5 more)

### Community 72 - "Upgrade progress (2026-10-30 brief: repair, computer use, voice, local AI, UI, installer)"
Cohesion: 0.14
Nodes (14): 0.2.1: testing the installed app found three bugs (fixed), 0.3.0: "too slow, nothing works, cmd windows" (fixed), 0.3.1: one icon everywhere, install location, settings diagnosis, 0.4.0: taskbar-glass island, Siri orb, rebindable keys, peeking and sitting, cute lines, Phase 11–12: tests and installer, Phase 1: audit and dev startup, Phase 4: coding and terminal (done), Phase 5: voice (done) (+6 more)

### Community 73 - "windows.ts"
Cohesion: 0.19
Nodes (10): devOrigin, devServerUrl, placeBeside(), glassSupported, ISLAND, loadPage(), Page, panelSpecs (+2 more)

### Community 74 - "projects.ts"
Cohesion: 0.18
Nodes (8): Owned, ProjectInfo, projectsPlugin(), resolveProject(), game, outside, plugin, root

### Community 75 - "main.ts"
Cohesion: 0.18
Nodes (9): applyState(), canvas, loadModel(), PERCH_LINES, scaleBy(), scene, speaker, stepScale() (+1 more)

### Community 76 - "AiSettings.tsx"
Cohesion: 0.24
Nodes (8): AiSettings(), choose(), gb(), host(), LocalModels(), findProvider(), PROVIDER_IDS, PROVIDERS

### Community 77 - "Island.tsx"
Cohesion: 0.24
Nodes (7): react-dom, Island(), Orb(), OrbMode, tail(), VOICE_LABEL, VoicePhase

### Community 79 - "voice.ts"
Cohesion: 0.40
Nodes (9): auth(), cleanTranscript(), endpoint(), failure(), MAX_AUDIO_BYTES, MAX_SPEECH_CHARS, synthesize(), transcribe() (+1 more)

### Community 81 - "character.ts"
Cohesion: 0.31
Nodes (8): CHARACTER_EVENTS, CharacterSnapshot, initialSnapshot, table, Target, TRANSIENT_MS, transition(), run()

### Community 82 - "OTHERAGENT.md — the whole story of Lumi, for the next AI"
Cohesion: 0.22
Nodes (9): 1. The project in one paragraph, 2. The owner and how to work with them, 3. Their machine and the environment, 5. Decisions worth knowing (see docs/DECISIONS.md), 6. How to test (and the traps), 7. Releasing, 8. Known issues and open items, 9. Ideas the owner may ask for next (+1 more)

### Community 83 - "main/ipc.ts"
Cohesion: 0.28
Nodes (8): handle(), on(), trusted(), InvokeChannel, InvokePayload, invokeSchemas, SendChannel, SendPayload

### Community 84 - "RichText.tsx"
Cohesion: 0.42
Nodes (6): Block, dedent(), inline, parseMarkdown(), RichText(), spans()

### Community 85 - "4. The story, in order"
Cohesion: 0.25
Nodes (8): 4.1 The original brief (milestones 0–9), 4.2 Polish round (after M9), 4.3 "Ollama shouldn't have to be open", natural pose, drag reactions, physics, graphics setting, 4.4 Model clipping, dead click zone, cmd ENOENT, 4.5 The 14-phase "complete repair" brief → 0.2.0, 4.6 "Too many bugs, too slow, keeps opening cmd" → 0.3.0, 4.7 Icon and install location → 0.3.1, 4. The story, in order

### Community 87 - "scene.ts"
Cohesion: 0.36
Nodes (7): three, loadAvatar(), addOffsets(), createScene(), applyGaze(), use(), QUALITY

### Community 88 - "AppState"
Cohesion: 0.29
Nodes (6): MODES, name(), STATUS, TasksPanel(), AppState, ClaudeMode

### Community 89 - "window-state.ts"
Cohesion: 0.33
Nodes (6): importLegacyJson(), Store, loadWindowState(), saveWindowState(), WindowStateFile, windowStateSchema

### Community 90 - "Lumi — project summary and handoff"
Cohesion: 0.33
Nodes (6): 1. How it is built (one screen), 2. What the user gets, 3. History (what was done, in order), 4. How to work on it, 5. Known limits (honest), Lumi — project summary and handoff

### Community 92 - "Lumi (Desktop Assistant)"
Cohesion: 0.40
Nodes (5): Configure, Develop, Docs, Lumi (Desktop Assistant), Use it (installed app)

### Community 93 - "aiConfig"
Cohesion: 0.40
Nodes (5): aiConfig(), chatStream(), localUrl(), startOllama(), withOllama()

## Knowledge Gaps
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Decisions (ADR log)` connect `Decisions (ADR log)` to `geometry.ts`, `README.md`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **Are the 36 inferred relationships involving `start()` (e.g. with `main/index.ts` and `.addLocal()`) actually correct?**
  _`start()` has 36 INFERRED edges - model-reasoned connections that need verification._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Why does `AppState` connect `AppState` to `shared/ipc.ts`, `main.ts`, `AiSettings.tsx`, `tools.test.ts`, `CharacterScene`, `OTHERAGENT.md — the whole story of Lumi, for the next AI`, `settings.ts`, `tray.ts`, `Settings.tsx`, `Decisions (ADR log)`, `main.ts`, `store.ts`, `preload/index.ts`, `Perch`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Should `start` be split into smaller, more focused modules?**
  _Cohesion score 0.12612612612612611 - nodes in this community are weakly interconnected._
- **Why does `start()` connect `start` to `security.ts`, `conversation.ts`, `web.ts`, `tools.test.ts`, `tasks.ts`, `commands.ts`, `hooks.ts`, `ref_node_path`, `settings.ts`, `main/index.ts`, `tray.ts`, `mcp.ts`, `vitest`, `store.ts`, `local.ts`, `provider.ts`, `schemas.ts`, `desktop.ts`, `projects.ts`, `AiSettings.tsx`, `voice.ts`, `character.ts`, `main/ipc.ts`, `window-state.ts`, `aiConfig`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Should `Code Review and Quality` be split into smaller, more focused modules?**
  _Cohesion score 0.06451612903225806 - nodes in this community are weakly interconnected._