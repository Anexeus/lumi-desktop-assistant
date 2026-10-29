# Graph Report - Desktop Assistant  (2026-10-29)

## Corpus Check
- 100 files · ~69,875 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: .css 5, (none) 3, .vrm 1)

## Summary
- 1028 nodes · 1551 edges · 54 communities (48 shown, 6 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 43 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `60e42093`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- windows.ts
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
- character.ts
- compilerOptions
- Accessibility Checklist
- compilerOptions
- react
- Testing Patterns Reference (JavaScript/TypeScript)
- Decisions (ADR log)
- Key modules
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
- provider.ts
- @pixiv/three-vrm
- typescript@6.0.3
- vite@8.3.5
- store.ts
- provider.ts
- schemas.ts
- settings.ts
- main/index.ts
- tray.ts
- @playwright/test

## God Nodes (most connected - your core abstractions)
1. `start()` - 52 edges
2. `Decisions (ADR log)` - 28 edges
3. `WindowManager` - 23 edges
4. `Code Review and Quality` - 19 edges
5. `Conversation` - 16 edges
6. `react` - 15 edges
7. `vitest` - 15 edges
8. `ProviderError` - 15 edges
9. `compilerOptions` - 15 edges
10. `Security Checklist` - 15 edges

## Surprising Connections (you probably didn't know these)
- `ADR-015 Character state machine lives in main (2026-10-29)` --references--> `AppState`  [INFERRED]
  docs/DECISIONS.md → src/shared/ipc.ts
- `Conversation engine (main)` --references--> `text()`  [INFERRED]
  docs/ARCHITECTURE.md → src/main/vrm-meta.ts
- `2. Readability & Simplicity` --references--> `data()`  [INFERRED]
  .claude/skills/code-review-and-quality/SKILL.md → tests/unit/provider.test.ts
- `slow()` --calls--> `ProviderError`  [EXTRACTED]
  tests/unit/conversation.test.ts → src/main/ai/provider.ts
- `setup()` --calls--> `Conversation`  [EXTRACTED]
  tests/unit/conversation.test.ts → src/main/ai/conversation.ts

## Import Cycles
- None detected.

## Communities (54 total, 6 thin omitted)

### Community 0 - "windows.ts"
Cohesion: 0.14
Nodes (19): vitest@5.0.5, electron, vitest, devOrigin, devServerUrl, APP_HOST, APP_SCHEME, devCsp() (+11 more)

### Community 1 - "devDependencies"
Cohesion: 0.13
Nodes (15): devDependencies, electron@45.1.0, electron-builder@26.18.0, eslint@10.13.0, react@19.3.1, @types/node@24.19.2, @types/react@19.3.0, @types/react-dom@19.3.0 (+7 more)

### Community 2 - "start"
Cohesion: 0.11
Nodes (20): CHARACTER_DEFAULT, CHARACTER_MAX, CHARACTER_MIN, clampSize(), defaultPlacement(), fitToDisplays(), overlap(), placeBeside() (+12 more)

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
Cohesion: 0.19
Nodes (8): characterState(), launch(), openPanel(), page(), pageErrors, pages(), requests, speech

### Community 15 - "electron-builder.yml"
Cohesion: 0.10
Nodes (19): appId, asar, directories, output, electronFuses, enableCookieEncryption, enableEmbeddedAsarIntegrityValidation, enableNodeCliInspectArguments (+11 more)

### Community 16 - "Security Checklist"
Cohesion: 0.11
Nodes (17): AI / LLM Security, Authentication, Authorization, CORS Configuration, Data Protection, Dependency Security, Destructive Path Operations, Error Handling (+9 more)

### Community 17 - "character.ts"
Cohesion: 0.07
Nodes (28): three@0.186.1, three, Avatar, loadAvatar(), Pose, POSES, VISEMES, addOffsets() (+20 more)

### Community 18 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, composite, esModuleInterop, isolatedModules, lib, module, moduleResolution, noEmit (+9 more)

### Community 19 - "Accessibility Checklist"
Cohesion: 0.12
Nodes (16): Accessibility Checklist, Accessible Lists, ARIA Roles, Buttons vs. Links, Common Anti-Patterns, Common HTML Patterns, Content, Essential Checks (+8 more)

### Community 20 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, composite, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+8 more)

### Community 21 - "react"
Cohesion: 0.07
Nodes (41): ADR-015 Character state machine lives in main (2026-10-29), react-dom@19.3.1, react, react-dom, createSpeaker(), enqueue(), finishIfDone(), playWav() (+33 more)

### Community 22 - "Testing Patterns Reference (JavaScript/TypeScript)"
Cohesion: 0.14
Nodes (13): API / Integration Testing, Common Assertions, E2E Testing (Playwright), Mock at Boundaries Only, Mock Functions, Mock Modules, Mocking Patterns, React/Component Testing (+5 more)

### Community 23 - "Decisions (ADR log)"
Cohesion: 0.07
Nodes (27): ADR-001 Electron over Tauri (2026-10-29), ADR-002 React instead of Vue (2026-10-29), ADR-003 No Python backend (2026-10-29), ADR-004 Privileged work only in main; sandboxed renderers (2026-10-29), ADR-005 OmniRoute not adopted (2026-10-29), ADR-006 Claude Code via hooks + headless CLI (2026-10-29), ADR-007 SQLite driver: `node:sqlite` (decided 2026-10-29), ADR-008 Agent-skills subset instead of full plugin (2026-10-29) (+19 more)

### Community 24 - "Key modules"
Cohesion: 0.17
Nodes (11): Architecture, Character state machine (pure TS, renderer), Claude Code bridge, Key modules, Memory, Plugin registry, tools, permissions, Repository layout (from Milestone 1), Shape (+3 more)

### Community 25 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, lib, module, moduleResolution, noEmit, paths, skipLibCheck, strict (+4 more)

### Community 26 - "The Standing Checklist"
Cohesion: 0.18
Nodes (10): Correctness, Definition of Done, Definition of Done vs. Acceptance Criteria, Documentation, How to Apply, Integration, Quality, Red Flags (+2 more)

### Community 27 - "Development Tools"
Cohesion: 0.18
Nodes (11): A. Ponytail, Additional plugins (official marketplace `claude-plugins-official`), B. OmniRoute, C. Graphify, Configuration backup, Configuration changes, D. Addy Osmani Agent Skills, Development Tools (+3 more)

### Community 28 - "README.md"
Cohesion: 0.18
Nodes (5): Milestone 1 plan (implemented 2026-10-29; kept for reference), Roadmap, Desktop Assistant, Docs, Run it

### Community 29 - "scripts"
Cohesion: 0.20
Nodes (10): scripts, build, dev, lint, package, package:dir, preview, test (+2 more)

### Community 30 - "Security"
Cohesion: 0.18
Nodes (11): Claude Code, Dependency policy, Development-tool risks (this repo), Electron baseline (enforced from Milestone 1), MCP, Microphone and voice (Milestone 4), Secrets, Security (+3 more)

### Community 31 - "Current State"
Cohesion: 0.13
Nodes (15): Bugs found and fixed while testing (Milestone 1), Bugs found and fixed while testing (Milestone 2), Current State, Findings while testing (Milestone 3), Findings while testing (Milestones 4–5), Known issues / follow-ups, Livelier character (new), Milestone 2: character (+7 more)

### Community 32 - "Reference Research"
Cohesion: 0.25
Nodes (7): 1. AIRI (moeru-ai/airi): primary reference, 2. Xiaoke AI (liupig/xiaokeai), 3. YUI (yw0nam/YUI): ideas only (noncommercial license), Cross-cutting conclusions, Licensing summary (read first), Reference Research, Snapshot

### Community 33 - "shared/ipc.ts"
Cohesion: 0.05
Nodes (11): api, Window, AssistantApi, ChatEvent, ChooseModelResult, Events, ListModelsResult, ModelInfo (+3 more)

### Community 34 - "Desktop Assistant: instructions for Claude Code"
Cohesion: 0.29
Nodes (6): Assets and licenses, Desktop Assistant: instructions for Claude Code, graphify, Security invariants (do not weaken), Stack and commands, Working rules

### Community 35 - "Installation"
Cohesion: 0.33
Nodes (5): Claude Code tooling (reproduce on another machine), Installation, Local AI (Ollama), Prerequisites, Troubleshooting

### Community 38 - "package.json"
Cohesion: 0.17
Nodes (12): dependencies, zod@4.6.7, description, engines, node, license, main, name (+4 more)

### Community 39 - "Application Plugin Registry (design)"
Cohesion: 0.29
Nodes (6): Application Plugin Registry (design), Enforcement, Lifecycle, Manifest, Planned built-ins, Scope (v1)

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
Cohesion: 0.10
Nodes (18): Conversation, ConversationDeps, systemPrompt(), ChatMessage, CHARACTER_EVENTS, CharacterEvent, CharacterSnapshot, initialSnapshot (+10 more)

### Community 47 - "store.ts"
Cohesion: 0.10
Nodes (15): HELP, MAX_MEMORY_CHARS, runCommand(), saveMemory(), looksSensitive(), luhn(), PATTERNS, createStore() (+7 more)

### Community 48 - "provider.ts"
Cohesion: 0.15
Nodes (20): createThinkFilter(), describeHttpError(), endpoint(), headers(), listModels(), ProviderConfig, ProviderError, ProviderErrorKind (+12 more)

### Community 49 - "schemas.ts"
Cohesion: 0.13
Nodes (20): handle(), on(), trusted(), Invoke, aiSettingsSchema, baseUrlSchema, boundsSchema, coord (+12 more)

### Community 50 - "settings.ts"
Cohesion: 0.17
Nodes (19): DEFAULT_AI, DEFAULT_VOICE, getSecret(), hasSecret(), importLegacyJson(), isLocalUrl(), loadSettings(), path() (+11 more)

### Community 51 - "main/index.ts"
Cohesion: 0.22
Nodes (11): Conversation engine (main), customPath(), DEFAULT_MODEL, importModel(), readCustomModel(), removeCustomModel(), MAX_MODEL_BYTES, readVrmMeta() (+3 more)

### Community 52 - "tray.ts"
Cohesion: 0.24
Nodes (4): createTray(), icon(), menuTemplate(), TrayActions

## Knowledge Gaps
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AppState` connect `react` to `shared/ipc.ts`, `main/index.ts`, `tray.ts`, `character.ts`?**
  _High betweenness centrality (0.097) - this node is a cross-community bridge._
- **Are the 21 inferred relationships involving `start()` (e.g. with `main/index.ts` and `.addLocal()`) actually correct?**
  _`start()` has 21 INFERRED edges - model-reasoned connections that need verification._
- **Should `windows.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1396011396011396 - nodes in this community are weakly interconnected._
- **Why does `ADR-015 Character state machine lives in main (2026-10-29)` connect `react` to `Decisions (ADR log)`?**
  _High betweenness centrality (0.093) - this node is a cross-community bridge._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Why does `Decisions (ADR log)` connect `Decisions (ADR log)` to `README.md`, `react`?**
  _High betweenness centrality (0.091) - this node is a cross-community bridge._
- **Should `start` be split into smaller, more focused modules?**
  _Cohesion score 0.10609756097560975 - nodes in this community are weakly interconnected._