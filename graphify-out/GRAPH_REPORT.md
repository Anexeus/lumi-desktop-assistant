# Graph Report - Desktop Assistant  (2026-11-02)

## Corpus Check
- 160 files · ~148,722 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 20 file(s) not represented in the graph (top: .vrm 10, .css 7, (none) 3)

## Summary
- 1756 nodes · 3169 edges · 98 communities (82 shown, 16 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 106 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e5d60722`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- start
- devDependencies
- CharacterScene
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
- speaker.ts
- compilerOptions
- The Standing Checklist
- Development Tools
- README.md
- scripts
- react
- Current State
- Reference Research
- shared/ipc.ts
- main/index.ts
- Installation
- tsconfig.json
- .claude/CLAUDE.md
- package.json
- windows.ts
- eslint.config.mjs
- electron.vite.config.ts
- Third-party notices
- provider.ts
- web.ts
- PermissionBroker
- hooks.ts
- commands.ts
- tasks.ts
- store.ts
- settings.ts
- model.ts
- TrayActions
- main.ts
- mcp.ts
- AssistantApi
- muscles.ts
- useVoiceMode.ts
- character.ts
- zod
- library.ts
- fake-claude.mjs
- local.ts
- @modelcontextprotocol/sdk
- main/ipc.ts
- react
- Perch
- schemas.ts
- desktop.ts
- security.ts
- desktop.ps1
- store.ts
- Upgrade progress (2026-10-30 brief: repair, computer use, voice, local AI, UI, installer)
- shortcuts.ts
- ref_node_path
- .characterBounds
- schemas.test.ts
- Avatar
- window-state.ts
- RichText.tsx
- .constructor
- characters.ts
- 4. The story, in order
- Desktop Assistant: instructions for Claude Code
- projects.ts
- Application Plugin Registry (design)
- TasksPanel.tsx
- scene.ts
- preload/index.ts
- MateSource
- Lumi — project summary and handoff
- ROADMAP.md
- Lumi (Desktop Assistant)
- ToolsSettings.tsx
- electron-builder@26.18.0
- @pixiv/three-vrm
- @ghostery/adblocker
- @types/react@19.3.0

## God Nodes (most connected - your core abstractions)
1. `start()` - 119 edges
2. `Decisions (ADR log)` - 81 edges
3. `WindowManager` - 41 edges
4. `vitest` - 27 edges
5. `tool` - 27 edges
6. `react` - 23 edges
7. `Current State` - 23 edges
8. `Upgrade progress (2026-10-30 brief: repair, computer use, voice, local AI, UI, installer)` - 23 edges
9. `AssistantApi` - 22 edges
10. `ProviderError` - 20 edges

## Surprising Connections (you probably didn't know these)
- `Phase 14: mouse-wheel resize (done first: smallest, self-contained)` --references--> `scaleBounds()`  [INFERRED]
  docs/UPGRADE_PROGRESS.md → src/main/geometry.ts
- `Character state machine (pure TS, renderer)` --references--> `notify()`  [INFERRED]
  docs/ARCHITECTURE.md → src/main/index.ts
- `Stack and commands` --references--> `PermissionBroker`  [INFERRED]
  CLAUDE.md → src/main/tools/broker.ts
- `ADR-015 Character state machine lives in main (2026-10-29)` --references--> `AppState`  [INFERRED]
  docs/DECISIONS.md → src/shared/ipc.ts
- `5. Decisions worth knowing (see docs/DECISIONS.md)` --references--> `AppState`  [INFERRED]
  OTHERAGENT.md → src/shared/ipc.ts

## Import Cycles
- None detected.

## Communities (98 total, 16 thin omitted)

### Community 0 - "start"
Cohesion: 0.12
Nodes (15): appIcon(), start(), aiConfig(), chatStream(), emergencyStop(), fire(), localUrl(), notify() (+7 more)

### Community 1 - "devDependencies"
Cohesion: 0.14
Nodes (14): devDependencies, electron@45.1.0, react@19.3.1, react-dom@19.3.1, three@0.186.1, @types/node@24.19.2, @types/three@0.186.0, typescript@6.0.3 (+6 more)

### Community 3 - "Code Review and Quality"
Cohesion: 0.06
Nodes (30): 1. Correctness, 2. Readability & Simplicity, 3. Architecture, 4. Security, 5. Performance, Change Descriptions, Change Sizing, Code Review and Quality (+22 more)

### Community 4 - "Test-Driven Development"
Cohesion: 0.07
Nodes (29): Browser Testing with DevTools, Common Rationalizations, DAMP Over DRY in Tests, Decision Guide, Discover the Stack First, Name Tests Descriptively, One Assertion Per Concept, Overview (+21 more)

### Community 5 - "Performance Checklist"
Cohesion: 0.07
Nodes (27): API, Backend Checklist, Cache checklist, Caching Strategies, Common Anti-Patterns, Connection pooling, Core Web Vitals Targets, CSS (+19 more)

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
Nodes (25): appId, asar, directories, output, electronFuses, enableCookieEncryption, enableEmbeddedAsarIntegrityValidation, enableNodeCliInspectArguments (+17 more)

### Community 16 - "Security Checklist"
Cohesion: 0.11
Nodes (17): AI / LLM Security, Authentication, Authorization, CORS Configuration, Data Protection, Dependency Security, Destructive Path Operations, Error Handling (+9 more)

### Community 17 - "avatar.ts"
Cohesion: 0.23
Nodes (13): MATE_FADE, MATE_ONCE, Pose, POSES, VISEMES, envelope(), GESTURE_SECONDS, gestureOffsets() (+5 more)

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
Cohesion: 0.13
Nodes (13): ClaudeSettings(), IntegrationsSettings(), PRESETS, STATUS, MateSettings(), GRAPHICS, Settings(), SHORTCUT_LABELS (+5 more)

### Community 22 - "Testing Patterns Reference (JavaScript/TypeScript)"
Cohesion: 0.14
Nodes (13): API / Integration Testing, Common Assertions, E2E Testing (Playwright), Mock at Boundaries Only, Mock Functions, Mock Modules, Mocking Patterns, React/Component Testing (+5 more)

### Community 23 - "Decisions (ADR log)"
Cohesion: 0.03
Nodes (77): ADR-001 Electron over Tauri (2026-10-29), ADR-002 React instead of Vue (2026-10-29), ADR-003 No Python backend (2026-10-29), ADR-004 Privileged work only in main; sandboxed renderers (2026-10-29), ADR-005 OmniRoute not adopted (2026-10-29), ADR-006 Claude Code via hooks + headless CLI (2026-10-29), ADR-007 SQLite driver: `node:sqlite` (decided 2026-10-29), ADR-008 Agent-skills subset instead of full plugin (2026-10-29) (+69 more)

### Community 24 - "speaker.ts"
Cohesion: 0.11
Nodes (27): createSpeaker(), enqueue(), finishIfDone(), playWav(), pump(), speakWithWindows(), Sentence, mouthLevel() (+19 more)

### Community 25 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, lib, module, moduleResolution, noEmit, paths, skipLibCheck, strict (+4 more)

### Community 26 - "The Standing Checklist"
Cohesion: 0.18
Nodes (10): Correctness, Definition of Done, Definition of Done vs. Acceptance Criteria, Documentation, How to Apply, Integration, Quality, Red Flags (+2 more)

### Community 27 - "Development Tools"
Cohesion: 0.15
Nodes (12): A. Ponytail, Additional plugins (official marketplace `claude-plugins-official`), B. OmniRoute, C. Graphify, Configuration backup, Configuration changes, D. Addy Osmani Agent Skills, Development Tools (+4 more)

### Community 29 - "scripts"
Cohesion: 0.18
Nodes (11): scripts, build, dev, lint, package, package:dir, preview, runtimes (+3 more)

### Community 30 - "react"
Cohesion: 0.17
Nodes (14): Island(), tail(), VOICE_LABEL, Icon(), ICONS, Menu(), STATUS, Orb() (+6 more)

### Community 31 - "Current State"
Cohesion: 0.08
Nodes (23): Bugs found and fixed while testing (Milestone 1), Bugs found and fixed while testing (Milestone 2), Current State, Findings while testing (Milestone 3), Findings while testing (Milestones 4–5), Findings while testing (Milestones 6–9), Known issues / follow-ups, Livelier character (new) (+15 more)

### Community 32 - "Reference Research"
Cohesion: 0.25
Nodes (7): 1. AIRI (moeru-ai/airi): primary reference, 2. Xiaoke AI (liupig/xiaokeai), 3. YUI (yw0nam/YUI): ideas only (noncommercial license), Cross-cutting conclusions, Licensing summary (read first), Reference Research, Snapshot

### Community 33 - "shared/ipc.ts"
Cohesion: 0.03
Nodes (7): ClaudeState, LocalState, MateState, MenuAction, ModelInfo, SpeechResult, TranscribeResult

### Community 34 - "main/index.ts"
Cohesion: 0.12
Nodes (22): electron, findClaude(), DEBUG_SWITCHES, locked, ADR-0075, appsPlugin(), filesPlugin(), findApp() (+14 more)

### Community 35 - "Installation"
Cohesion: 0.22
Nodes (8): Claude Code tooling (reproduce on another machine), Development environment (set up on 2026-10-29), Install Lumi (end users), Installation, Local AI (Ollama), Prerequisites, Troubleshooting, Troubleshooting (app)

### Community 38 - "package.json"
Cohesion: 0.14
Nodes (13): description, eslint@10.13.0, @types/react-dom@19.3.0, engines, node, license, main, name (+5 more)

### Community 39 - "windows.ts"
Cohesion: 0.13
Nodes (29): ADR-054 Peeking from screen edges and sitting on app windows (2026-10-30), 4.8 This round → 0.4.0, canSit(), CHARACTER_DEFAULT, CHARACTER_MAX, CHARACTER_MIN, clampSize(), contains() (+21 more)

### Community 40 - "eslint.config.mjs"
Cohesion: 0.29
Nodes (6): @eslint/js@10.0.1, globals@17.13.0, typescript-eslint@8.72.1, @eslint/js, globals, typescript-eslint

### Community 41 - "electron.vite.config.ts"
Cohesion: 0.33
Nodes (5): shared, electron-vite@6.0.0, @vitejs/plugin-react@6.1.2, electron-vite, @vitejs/plugin-react

### Community 42 - "Third-party notices"
Cohesion: 0.40
Nodes (4): Claude Code skills (development only, not shipped), npm packages, Seed-san (default character model), Third-party notices

### Community 43 - "provider.ts"
Cohesion: 0.06
Nodes (43): ADR-080 Showcase speed: a cache-friendly prompt, a warm start, crowd-proof listening (2026-11-02), Conversation, ConversationDeps, parseWrittenToolCall(), systemPrompt(), wrapToolResult(), ChatMessage, createThinkFilter() (+35 more)

### Community 44 - "web.ts"
Cohesion: 0.14
Nodes (11): blockAds(), browser(), downloadName(), lenientItem(), load(), openArgs, openInput, Site (+3 more)

### Community 45 - "PermissionBroker"
Cohesion: 0.15
Nodes (11): ADR-079 No approval cards for old profiles; head turns are added to the clip, never piled up (2026-11-01), ToolSpec, PermissionBroker, resolve(), createRegistry(), Registry, runToolCall(), ToolOutcome (+3 more)

### Community 46 - "hooks.ts"
Cohesion: 0.17
Nodes (15): ClaudeSettings, EVENTS, eventSchema, HOOK_PORT, hookCommand(), HookEntry, HookEvent, hooksInstalled() (+7 more)

### Community 47 - "commands.ts"
Cohesion: 0.23
Nodes (8): HELP, MAX_MEMORY_CHARS, runCommand(), saveMemory(), looksSensitive(), luhn(), PATTERNS, SaveResult

### Community 48 - "tasks.ts"
Cohesion: 0.20
Nodes (8): Planned built-ins, ClaudeTasks, describeEvent(), explainFailure(), TaskRunnerDeps, ClaudeMode, ClaudeTask, runner()

### Community 49 - "store.ts"
Cohesion: 0.13
Nodes (4): @playwright/test@1.64.1, @playwright/test, expectedConsoleErrors, pageErrors

### Community 50 - "settings.ts"
Cohesion: 0.15
Nodes (21): ADR-0079, DEFAULT_AI, DEFAULT_LOCAL, DEFAULT_NAME, DEFAULT_TOOLS, DEFAULT_VOICE, getSecret(), hasSecret() (+13 more)

### Community 51 - "model.ts"
Cohesion: 0.09
Nodes (28): Architecture, Character state machine (pure TS, renderer), Claude Code bridge, Conversation engine (main), Key modules, Memory, Plugin registry, tools, permissions, Repository layout (from Milestone 1) (+20 more)

### Community 53 - "main.ts"
Cohesion: 0.12
Nodes (21): activeAt, applyMate(), applyState(), canvas, clipCache, endPress(), loadClip(), loadModel() (+13 more)

### Community 54 - "mcp.ts"
Cohesion: 0.23
Nodes (8): Connection, McpManager, McpToolInfo, mcpToolName(), parseCommandLine(), slug(), McpServerConfig, McpServerInfo

### Community 56 - "muscles.ts"
Cohesion: 0.10
Nodes (38): convertClip(), Key, num(), parseAnim(), round(), sampleCurve(), UnityClip, BY_BONE (+30 more)

### Community 57 - "useVoiceMode.ts"
Cohesion: 0.23
Nodes (12): MicButton(), RecorderStatus, useRecorder(), useVoiceMode(), VAD, vadInit(), VadState, vadStep() (+4 more)

### Community 58 - "character.ts"
Cohesion: 0.31
Nodes (8): CHARACTER_EVENTS, CharacterSnapshot, initialSnapshot, table, Target, TRANSIENT_MS, transition(), run()

### Community 59 - "zod"
Cohesion: 0.15
Nodes (10): dependencies, zod@4.6.7, zod, githubPlugin(), repoSchema, Permission, Plugin, tool (+2 more)

### Community 60 - "library.ts"
Cohesion: 0.11
Nodes (20): assetsOf(), CLIPS, guessMateFolder(), importMate(), ImportResult, MATE_CREDIT, mateId(), MODELS (+12 more)

### Community 62 - "local.ts"
Cohesion: 0.10
Nodes (14): root, RUNTIMES, downloadModel(), freePort(), listDevices(), LocalServer, pickDevice(), sha256File() (+6 more)

### Community 63 - "@modelcontextprotocol/sdk"
Cohesion: 0.50
Nodes (3): @modelcontextprotocol/sdk@1.32.2, @modelcontextprotocol/sdk, server

### Community 64 - "main/ipc.ts"
Cohesion: 0.32
Nodes (7): handle(), on(), trusted(), InvokeChannel, InvokePayload, SendChannel, SendPayload

### Community 65 - "react"
Cohesion: 0.23
Nodes (8): react, react-dom, Approvals(), Chat(), onKeyDown(), send(), TitleBar(), useConversation()

### Community 67 - "schemas.ts"
Cohesion: 0.10
Nodes (21): MENU_ACTIONS, acceleratorSchema, aiSettingsSchema, assistantNameSchema, baseUrlSchema, boundsSchema, characterChoiceSchema, coord (+13 more)

### Community 68 - "desktop.ts"
Cohesion: 0.13
Nodes (12): describeLook(), DesktopHelper, desktopPlugin(), Element, Look, Rect, rectText(), target (+4 more)

### Community 69 - "security.ts"
Cohesion: 0.08
Nodes (30): Claude Code, Dependency policy, Desktop control, project scripts, local engines, Development-tool risks (this repo), Electron baseline (enforced from Milestone 1), Mate Engine import (ADR-075), MCP, Microphone and voice (Milestone 4) (+22 more)

### Community 70 - "desktop.ps1"
Cohesion: 0.31
Nodes (16): Act(), Await(), Capture(), Click(), Elements(), EnsureTarget(), FindWindow(), Handle() (+8 more)

### Community 71 - "store.ts"
Cohesion: 0.23
Nodes (10): createStore(), MIGRATIONS, openStore(), StoredMessage, MemorySettings(), add(), when(), ConversationSummary (+2 more)

### Community 72 - "Upgrade progress (2026-10-30 brief: repair, computer use, voice, local AI, UI, installer)"
Cohesion: 0.09
Nodes (23): 0.2.1: testing the installed app found three bugs (fixed), 0.3.0: "too slow, nothing works, cmd windows" (fixed), 0.3.1: one icon everywhere, install location, settings diagnosis, 0.4.0: taskbar-glass island, Siri orb, rebindable keys, peeking and sitting, cute lines, 0.5.0: pill island, glass menu, guided API keys, 9 characters, side-on sitting, smoother resizing, 0.6.0: the AI does what it's told; one look everywhere; taskbar icon; front-facing sit, 0.7.0: Gemini voice fix, Miku by default, Desktop Mate–style poses, install apps, never asks, 0.8.0 (first part, built as 0.7.1, not released): legs in front of the taskbar, the first pick-up back, own models, Gemini tools, Mate Engine ideas, island fixes (+15 more)

### Community 73 - "shortcuts.ts"
Cohesion: 0.24
Nodes (10): ShortcutRow(), onKeyDown(), save(), DEFAULT_SHORTCUTS, isAccelerator(), KEYS, MODIFIERS, NAMED_KEYS (+2 more)

### Community 74 - "ref_node_path"
Cohesion: 0.19
Nodes (5): vitest, build, SIZES, redact(), startLog()

### Community 76 - "schemas.test.ts"
Cohesion: 0.29
Nodes (5): ADR-055 Settings are validated one by one (2026-10-30), Send, invokeSchemas, parseSettingsFile(), sendSchemas

### Community 77 - "Avatar"
Cohesion: 0.09
Nodes (5): three, Avatar, Gesture, QUALITY, CharacterState

### Community 78 - "window-state.ts"
Cohesion: 0.40
Nodes (4): Store, saveWindowState(), WindowStateFile, windowStateSchema

### Community 79 - "RichText.tsx"
Cohesion: 0.42
Nodes (6): Block, dedent(), inline, parseMarkdown(), RichText(), spans()

### Community 80 - ".constructor"
Cohesion: 0.33
Nodes (4): loadPage(), workAreas(), IslandStyle, WindowName

### Community 81 - "characters.ts"
Cohesion: 0.18
Nodes (9): Settings, CHARACTER_IDS, CharacterChoice, CharacterId, findCharacter(), MY_MODEL_ID, AiSettings, AiStatus (+1 more)

### Community 82 - "4. The story, in order"
Cohesion: 0.09
Nodes (22): 1. The project in one paragraph, 2. The owner and how to work with them, 3. Their machine and the environment, 4.10 "The AI does nothing I say; one look everywhere; taskbar icon; sit facing me" → 0.6.0, 4.11 Gemini, Miku by default, Desktop Mate poses, installs, never asks → 0.7.0, 4.12 Legs in front of the taskbar, the old pick-up, own models, Gemini tools, Mate Engine → 0.8.0, 4.13 Showcase build → 0.8.1, then 0.8.2, 4.1 The original brief (milestones 0–9) (+14 more)

### Community 83 - "Desktop Assistant: instructions for Claude Code"
Cohesion: 0.33
Nodes (6): Assets and licenses, Desktop Assistant: instructions for Claude Code, graphify, Security invariants (do not weaken), Stack and commands, Working rules

### Community 84 - "projects.ts"
Cohesion: 0.18
Nodes (8): Owned, ProjectInfo, projectsPlugin(), resolveProject(), game, outside, plugin, root

### Community 85 - "Application Plugin Registry (design)"
Cohesion: 0.33
Nodes (5): Application Plugin Registry (design), Enforcement, Lifecycle, Manifest, Scope (v1)

### Community 86 - "TasksPanel.tsx"
Cohesion: 0.29
Nodes (6): MODES, name(), STATUS, TasksPanel(), AppState, ShortcutAction

### Community 87 - "scene.ts"
Cohesion: 0.29
Nodes (8): loadAvatar(), holdPose(), startRole(), toThree(), addOffsets(), createScene(), applyGaze(), use()

### Community 88 - "preload/index.ts"
Cohesion: 0.40
Nodes (4): api, ChatEvent, Events, Invoke

### Community 90 - "Lumi — project summary and handoff"
Cohesion: 0.33
Nodes (6): 1. How it is built (one screen), 2. What the user gets, 3. History (what was done, in order), 4. How to work on it, 5. Known limits (honest), Lumi — project summary and handoff

### Community 92 - "Lumi (Desktop Assistant)"
Cohesion: 0.40
Nodes (5): Configure, Develop, Docs, Lumi (Desktop Assistant), Use it (installed app)

## Knowledge Gaps
- **5 isolated node(s):** `ADR-0075`, `ADR-0075`, `ADR-0075`, `ADR-0079`, `ADR-0075`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 921 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Decisions (ADR log)` connect `Decisions (ADR log)` to `windows.ts`, `provider.ts`, `schemas.test.ts`, `PermissionBroker`, `README.md`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **Are the 41 inferred relationships involving `start()` (e.g. with `main/index.ts` and `.addLocal()`) actually correct?**
  _`start()` has 41 INFERRED edges - model-reasoned connections that need verification._
- **What connects `ADR-0075`, `ADR-0075`, `ADR-0075` to the rest of the system?**
  _5 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `start` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._
- **Why does `start()` connect `start` to `speaker.ts`, `react`, `main/index.ts`, `provider.ts`, `web.ts`, `PermissionBroker`, `hooks.ts`, `commands.ts`, `tasks.ts`, `settings.ts`, `model.ts`, `mcp.ts`, `character.ts`, `zod`, `library.ts`, `local.ts`, `main/ipc.ts`, `Perch`, `desktop.ts`, `security.ts`, `store.ts`, `ref_node_path`, `.characterBounds`, `window-state.ts`, `characters.ts`, `projects.ts`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Why does `AppState` connect `TasksPanel.tsx` to `shared/ipc.ts`, `main/index.ts`, `store.ts`, `.characterBounds`, `Avatar`, `4. The story, in order`, `main.ts`, `Settings.tsx`, `Decisions (ADR log)`, `preload/index.ts`, `speaker.ts`, `react`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._