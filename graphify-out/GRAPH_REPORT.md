# Graph Report - Desktop Assistant  (2026-10-31)

## Corpus Check
- 161 files · ~146,147 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 21 file(s) not represented in the graph (top: .vrm 10, .css 7, (none) 3)

## Summary
- 1746 nodes · 3148 edges · 98 communities (79 shown, 19 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 101 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8d53ba5d`
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
- ref_node_fs
- Installation
- tsconfig.json
- .claude/CLAUDE.md
- package.json
- tasks.ts
- eslint.config.mjs
- electron.vite.config.ts
- Third-party notices
- Conversation
- web.ts
- registry.ts
- AiSettings.tsx
- commands.ts
- hooks.ts
- store.ts
- settings.ts
- model.ts
- TrayActions
- main.ts
- mcp.ts
- AssistantApi
- muscles.ts
- security.ts
- tools.spec.ts
- zod
- library.ts
- fake-claude.mjs
- local.ts
- zod
- DesktopHelper
- Chat.tsx
- provider.ts
- schemas.ts
- desktop.ts
- Security
- desktop.ps1
- store.ts
- Upgrade progress (2026-10-30 brief: repair, computer use, voice, local AI, UI, installer)
- useVoiceMode.ts
- ref_node_path
- ProviderError
- tools.test.ts
- Avatar
- three
- main/ipc.ts
- character.ts
- main/index.ts
- 4. The story, in order
- .send
- projects.ts
- Application Plugin Registry (design)
- @ghostery/adblocker
- scene.ts
- @types/node@24.19.2
- MateSource
- Lumi — project summary and handoff
- ROADMAP.md
- Lumi (Desktop Assistant)
- AiSettings
- electron-builder@26.18.0
- @pixiv/three-vrm
- @types/react@19.3.0
- @types/react-dom@19.3.0

## God Nodes (most connected - your core abstractions)
1. `start()` - 118 edges
2. `Decisions (ADR log)` - 79 edges
3. `WindowManager` - 41 edges
4. `vitest` - 27 edges
5. `tool` - 27 edges
6. `react` - 23 edges
7. `Current State` - 23 edges
8. `AssistantApi` - 22 edges
9. `Upgrade progress (2026-10-30 brief: repair, computer use, voice, local AI, UI, installer)` - 21 edges
10. `ProviderError` - 20 edges

## Surprising Connections (you probably didn't know these)
- `Phase 14: mouse-wheel resize (done first: smallest, self-contained)` --references--> `scaleBounds()`  [INFERRED]
  docs/UPGRADE_PROGRESS.md → src/main/geometry.ts
- `5. Decisions worth knowing (see docs/DECISIONS.md)` --references--> `AppState`  [INFERRED]
  OTHERAGENT.md → src/shared/ipc.ts
- `4.8 This round → 0.4.0` --references--> `peekPlacement()`  [INFERRED]
  OTHERAGENT.md → src/main/geometry.ts
- `4.8 This round → 0.4.0` --references--> `seatPlacement()`  [INFERRED]
  OTHERAGENT.md → src/main/geometry.ts
- `Character state machine (pure TS, renderer)` --references--> `notify()`  [INFERRED]
  docs/ARCHITECTURE.md → src/main/index.ts

## Import Cycles
- None detected.

## Communities (98 total, 19 thin omitted)

### Community 0 - "start"
Cohesion: 0.05
Nodes (54): Character state machine (pure TS, renderer), ADR-054 Peeking from screen edges and sitting on app windows (2026-10-30), canSit(), CHARACTER_DEFAULT, CHARACTER_MAX, CHARACTER_MIN, clampSize(), contains() (+46 more)

### Community 1 - "devDependencies"
Cohesion: 0.14
Nodes (13): devDependencies, @modelcontextprotocol/sdk@1.32.2, @playwright/test@1.64.1, react@19.3.1, @types/three@0.186.0, typescript@6.0.3, vite@8.3.5, vitest@5.0.5 (+5 more)

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
Cohesion: 0.22
Nodes (9): characterState(), fakeMicWav(), launch(), openPanel(), page(), pageErrors, pages(), requests (+1 more)

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
Cohesion: 0.07
Nodes (28): createTray(), ClaudeSettings(), IntegrationsSettings(), PRESETS, STATUS, MateSettings(), GRAPHICS, Settings() (+20 more)

### Community 22 - "Testing Patterns Reference (JavaScript/TypeScript)"
Cohesion: 0.14
Nodes (13): API / Integration Testing, Common Assertions, E2E Testing (Playwright), Mock at Boundaries Only, Mock Functions, Mock Modules, Mocking Patterns, React/Component Testing (+5 more)

### Community 23 - "Decisions (ADR log)"
Cohesion: 0.03
Nodes (76): ADR-001 Electron over Tauri (2026-10-29), ADR-002 React instead of Vue (2026-10-29), ADR-003 No Python backend (2026-10-29), ADR-004 Privileged work only in main; sandboxed renderers (2026-10-29), ADR-005 OmniRoute not adopted (2026-10-29), ADR-006 Claude Code via hooks + headless CLI (2026-10-29), ADR-007 SQLite driver: `node:sqlite` (decided 2026-10-29), ADR-008 Agent-skills subset instead of full plugin (2026-10-29) (+68 more)

### Community 24 - "speaker.ts"
Cohesion: 0.21
Nodes (15): createSpeaker(), enqueue(), finishIfDone(), playWav(), pump(), speakWithWindows(), Sentence, mouthLevel() (+7 more)

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
Cohesion: 0.14
Nodes (16): react-dom@19.3.1, react, react-dom, Island(), tail(), VOICE_LABEL, Icon(), ICONS (+8 more)

### Community 31 - "Current State"
Cohesion: 0.08
Nodes (23): Bugs found and fixed while testing (Milestone 1), Bugs found and fixed while testing (Milestone 2), Current State, Findings while testing (Milestone 3), Findings while testing (Milestones 4–5), Findings while testing (Milestones 6–9), Known issues / follow-ups, Livelier character (new) (+15 more)

### Community 32 - "Reference Research"
Cohesion: 0.25
Nodes (7): 1. AIRI (moeru-ai/airi): primary reference, 2. Xiaoke AI (liupig/xiaokeai), 3. YUI (yw0nam/YUI): ideas only (noncommercial license), Cross-cutting conclusions, Licensing summary (read first), Reference Research, Snapshot

### Community 33 - "shared/ipc.ts"
Cohesion: 0.03
Nodes (5): LocalState, MateState, ModelInfo, SpeechResult, TranscribeResult

### Community 34 - "ref_node_fs"
Cohesion: 0.16
Nodes (15): electron@45.1.0, electron, appsPlugin(), filesPlugin(), findApp(), InstalledApp, knownFolders(), noteFileName() (+7 more)

### Community 35 - "Installation"
Cohesion: 0.22
Nodes (8): Claude Code tooling (reproduce on another machine), Development environment (set up on 2026-10-29), Install Lumi (end users), Installation, Local AI (Ollama), Prerequisites, Troubleshooting, Troubleshooting (app)

### Community 38 - "package.json"
Cohesion: 0.17
Nodes (11): description, eslint@10.13.0, engines, node, license, main, name, private (+3 more)

### Community 39 - "tasks.ts"
Cohesion: 0.22
Nodes (7): Planned built-ins, ClaudeTasks, describeEvent(), explainFailure(), TaskRunnerDeps, ClaudeMode, ClaudeTask

### Community 40 - "eslint.config.mjs"
Cohesion: 0.29
Nodes (6): @eslint/js@10.0.1, globals@17.13.0, typescript-eslint@8.72.1, @eslint/js, globals, typescript-eslint

### Community 41 - "electron.vite.config.ts"
Cohesion: 0.33
Nodes (5): shared, electron-vite@6.0.0, @vitejs/plugin-react@6.1.2, electron-vite, @vitejs/plugin-react

### Community 42 - "Third-party notices"
Cohesion: 0.40
Nodes (4): Claude Code skills (development only, not shipped), npm packages, Seed-san (default character model), Third-party notices

### Community 43 - "Conversation"
Cohesion: 0.16
Nodes (6): Conversation, ChatItem, ChatSnapshot, Script, setup(), slow()

### Community 44 - "web.ts"
Cohesion: 0.14
Nodes (11): blockAds(), browser(), downloadName(), lenientItem(), load(), openArgs, openInput, Site (+3 more)

### Community 45 - "registry.ts"
Cohesion: 0.11
Nodes (17): Assets and licenses, Desktop Assistant: instructions for Claude Code, graphify, Security invariants (do not weaken), Stack and commands, Working rules, ToolCall, ToolSpec (+9 more)

### Community 46 - "AiSettings.tsx"
Cohesion: 0.21
Nodes (12): ADR-015 Character state machine lives in main (2026-10-29), AiSettings(), choose(), saveKey(), test(), gb(), host(), LocalModels() (+4 more)

### Community 47 - "commands.ts"
Cohesion: 0.23
Nodes (8): HELP, MAX_MEMORY_CHARS, runCommand(), saveMemory(), looksSensitive(), luhn(), PATTERNS, SaveResult

### Community 48 - "hooks.ts"
Cohesion: 0.16
Nodes (16): ClaudeSettings, EVENTS, eventSchema, HOOK_PORT, hookCommand(), HookEntry, HookEvent, hooksInstalled() (+8 more)

### Community 50 - "settings.ts"
Cohesion: 0.11
Nodes (26): DEFAULT_AI, DEFAULT_LOCAL, DEFAULT_NAME, DEFAULT_TOOLS, DEFAULT_VOICE, getSecret(), hasSecret(), importLegacyJson() (+18 more)

### Community 51 - "model.ts"
Cohesion: 0.09
Nodes (27): Architecture, Claude Code bridge, Conversation engine (main), Key modules, Memory, Plugin registry, tools, permissions, Repository layout (from Milestone 1), Shape (+19 more)

### Community 53 - "main.ts"
Cohesion: 0.12
Nodes (21): activeAt, applyMate(), applyState(), canvas, clipCache, endPress(), loadClip(), loadModel() (+13 more)

### Community 54 - "mcp.ts"
Cohesion: 0.23
Nodes (8): Connection, McpManager, McpToolInfo, mcpToolName(), parseCommandLine(), slug(), McpServerConfig, McpServerInfo

### Community 56 - "muscles.ts"
Cohesion: 0.10
Nodes (38): convertClip(), Key, num(), parseAnim(), round(), sampleCurve(), UnityClip, BY_BONE (+30 more)

### Community 57 - "security.ts"
Cohesion: 0.27
Nodes (11): APP_HOST, APP_SCHEME, devCsp(), isTrustedUrl(), PROD_CSP, resolveBundlePath(), hardenSession(), hardenWebContents() (+3 more)

### Community 58 - "tools.spec.ts"
Cohesion: 0.20
Nodes (6): chat(), HOOK_TOKEN, page(), pageErrors, Seen, TOOL_FOR

### Community 59 - "zod"
Cohesion: 0.18
Nodes (7): githubPlugin(), repoSchema, Permission, Plugin, tool, parseWingetSearch(), wingetPlugin()

### Community 60 - "library.ts"
Cohesion: 0.12
Nodes (19): assetsOf(), CLIPS, guessMateFolder(), importMate(), ImportResult, MATE_CREDIT, mateId(), MODELS (+11 more)

### Community 62 - "local.ts"
Cohesion: 0.12
Nodes (12): root, RUNTIMES, downloadModel(), freePort(), listDevices(), LocalServer, pickDevice(), sha256File() (+4 more)

### Community 63 - "zod"
Cohesion: 0.40
Nodes (4): dependencies, zod@4.6.7, zod, server

### Community 65 - "Chat.tsx"
Cohesion: 0.14
Nodes (15): Approvals(), Chat(), onKeyDown(), send(), MODES, name(), STATUS, TasksPanel() (+7 more)

### Community 66 - "provider.ts"
Cohesion: 0.19
Nodes (14): createThinkFilter(), describeHttpError(), describeImage(), endpoint(), headers(), listModels(), ProviderConfig, ProviderErrorKind (+6 more)

### Community 67 - "schemas.ts"
Cohesion: 0.08
Nodes (27): ADR-055 Settings are validated one by one (2026-10-30), 4.8 This round → 0.4.0, MENU_ACTIONS, acceleratorSchema, aiSettingsSchema, assistantNameSchema, baseUrlSchema, boundsSchema (+19 more)

### Community 68 - "desktop.ts"
Cohesion: 0.17
Nodes (11): describeLook(), desktopPlugin(), Element, Look, Rect, rectText(), target, Vision (+3 more)

### Community 69 - "Security"
Cohesion: 0.12
Nodes (16): Claude Code, Dependency policy, Desktop control, project scripts, local engines, Development-tool risks (this repo), Electron baseline (enforced from Milestone 1), Mate Engine import (ADR-075), MCP, Microphone and voice (Milestone 4) (+8 more)

### Community 70 - "desktop.ps1"
Cohesion: 0.31
Nodes (16): Act(), Await(), Capture(), Click(), Elements(), EnsureTarget(), FindWindow(), Handle() (+8 more)

### Community 71 - "store.ts"
Cohesion: 0.25
Nodes (9): createStore(), MIGRATIONS, openStore(), StoredMessage, MemorySettings(), when(), ConversationSummary, MemoryItem (+1 more)

### Community 72 - "Upgrade progress (2026-10-30 brief: repair, computer use, voice, local AI, UI, installer)"
Cohesion: 0.10
Nodes (21): 0.2.1: testing the installed app found three bugs (fixed), 0.3.0: "too slow, nothing works, cmd windows" (fixed), 0.3.1: one icon everywhere, install location, settings diagnosis, 0.4.0: taskbar-glass island, Siri orb, rebindable keys, peeking and sitting, cute lines, 0.5.0: pill island, glass menu, guided API keys, 9 characters, side-on sitting, smoother resizing, 0.6.0: the AI does what it's told; one look everywhere; taskbar icon; front-facing sit, 0.7.0: Gemini voice fix, Miku by default, Desktop Mate–style poses, install apps, never asks, 0.8.0 (first part, built as 0.7.1, not released): legs in front of the taskbar, the first pick-up back, own models, Gemini tools, Mate Engine ideas, island fixes (+13 more)

### Community 73 - "useVoiceMode.ts"
Cohesion: 0.23
Nodes (12): MicButton(), RecorderStatus, useRecorder(), useVoiceMode(), VAD, vadInit(), VadState, vadStep() (+4 more)

### Community 74 - "ref_node_path"
Cohesion: 0.13
Nodes (9): vitest, build, SIZES, redact(), startLog(), game, outside, plugin (+1 more)

### Community 75 - "ProviderError"
Cohesion: 0.35
Nodes (11): modelMissing(), ProviderError, auth(), cleanTranscript(), endpoint(), failure(), MAX_AUDIO_BYTES, MAX_SPEECH_CHARS (+3 more)

### Community 76 - "tools.test.ts"
Cohesion: 0.26
Nodes (8): parseWrittenToolCall(), systemPrompt(), wrapToolResult(), ChatMessage, StreamEvent, CharacterEvent, plugin, ran

### Community 79 - "main/ipc.ts"
Cohesion: 0.24
Nodes (9): devOrigin, devServerUrl, handle(), on(), trusted(), InvokeChannel, InvokePayload, SendChannel (+1 more)

### Community 80 - "character.ts"
Cohesion: 0.31
Nodes (8): CHARACTER_EVENTS, CharacterSnapshot, initialSnapshot, table, Target, TRANSIENT_MS, transition(), run()

### Community 81 - "main/index.ts"
Cohesion: 0.10
Nodes (22): findClaude(), DEBUG_SWITCHES, locked, ADR-0075, registerAppScheme(), isLocalUrl(), api, CHARACTER_IDS (+14 more)

### Community 82 - "4. The story, in order"
Cohesion: 0.10
Nodes (21): 1. The project in one paragraph, 2. The owner and how to work with them, 3. Their machine and the environment, 4.10 "The AI does nothing I say; one look everywhere; taskbar icon; sit facing me" → 0.6.0, 4.11 Gemini, Miku by default, Desktop Mate poses, installs, never asks → 0.7.0, 4.12 Legs in front of the taskbar, the old pick-up, own models, Gemini tools, Mate Engine → 0.8.0, 4.1 The original brief (milestones 0–9), 4.2 Polish round (after M9) (+13 more)

### Community 84 - "projects.ts"
Cohesion: 0.29
Nodes (4): Owned, ProjectInfo, projectsPlugin(), resolveProject()

### Community 85 - "Application Plugin Registry (design)"
Cohesion: 0.33
Nodes (5): Application Plugin Registry (design), Enforcement, Lifecycle, Manifest, Scope (v1)

### Community 87 - "scene.ts"
Cohesion: 0.27
Nodes (9): loadAvatar(), holdPose(), startRole(), toThree(), addOffsets(), createScene(), applyGaze(), use() (+1 more)

### Community 89 - "MateSource"
Cohesion: 0.33
Nodes (3): MateSource, MateClip, MateRole

### Community 90 - "Lumi — project summary and handoff"
Cohesion: 0.33
Nodes (6): 1. How it is built (one screen), 2. What the user gets, 3. History (what was done, in order), 4. How to work on it, 5. Known limits (honest), Lumi — project summary and handoff

### Community 92 - "Lumi (Desktop Assistant)"
Cohesion: 0.40
Nodes (5): Configure, Develop, Docs, Lumi (Desktop Assistant), Use it (installed app)

### Community 93 - "AiSettings"
Cohesion: 0.67
Nodes (3): AiSettings, AiStatus, ProviderId

## Knowledge Gaps
- **4 isolated node(s):** `ADR-0075`, `ADR-0075`, `ADR-0075`, `ADR-0075`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 915 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AppState` connect `AiSettings.tsx` to `start`, `Chat.tsx`, `shared/ipc.ts`, `CharacterScene`, `store.ts`, `main/index.ts`, `4. The story, in order`, `settings.ts`, `main.ts`, `Settings.tsx`, `speaker.ts`, `react`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **Are the 40 inferred relationships involving `start()` (e.g. with `main/index.ts` and `.addLocal()`) actually correct?**
  _`start()` has 40 INFERRED edges - model-reasoned connections that need verification._
- **What connects `ADR-0075`, `ADR-0075`, `ADR-0075` to the rest of the system?**
  _4 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `start` be split into smaller, more focused modules?**
  _Cohesion score 0.05240549828178694 - nodes in this community are weakly interconnected._
- **Why does `start()` connect `start` to `Settings.tsx`, `ref_node_fs`, `tasks.ts`, `Conversation`, `web.ts`, `registry.ts`, `AiSettings.tsx`, `commands.ts`, `hooks.ts`, `settings.ts`, `model.ts`, `mcp.ts`, `security.ts`, `zod`, `library.ts`, `local.ts`, `DesktopHelper`, `provider.ts`, `desktop.ts`, `store.ts`, `ref_node_path`, `ProviderError`, `main/ipc.ts`, `character.ts`, `main/index.ts`, `.send`, `projects.ts`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Why does `Decisions (ADR log)` connect `Decisions (ADR log)` to `start`, `schemas.ts`, `README.md`, `AiSettings.tsx`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._