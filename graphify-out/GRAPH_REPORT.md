# Graph Report - Desktop Assistant  (2026-10-29)

## Corpus Check
- 72 files · ~51,248 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: .css 4, (none) 3, .vrm 1)

## Summary
- 803 nodes · 1028 edges · 47 communities (40 shown, 7 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `88ba70bd`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- main/index.ts
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
- security.ts
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
- AssistantApi
- Desktop Assistant: instructions for Claude Code
- Installation
- tsconfig.json
- .claude/CLAUDE.md
- package.json
- Application Plugin Registry (design)
- eslint.config.mjs
- electron.vite.config.ts
- Third-party notices
- @playwright/test
- @pixiv/three-vrm
- typescript@6.0.3
- vite@8.3.5

## God Nodes (most connected - your core abstractions)
1. `start()` - 27 edges
2. `Code Review and Quality` - 19 edges
3. `Decisions (ADR log)` - 19 edges
4. `WindowManager` - 18 edges
5. `compilerOptions` - 15 edges
6. `Security Checklist` - 15 edges
7. `Test-Driven Development` - 15 edges
8. `compilerOptions` - 14 edges
9. `Browser Testing with DevTools` - 13 edges
10. `Documentation and ADRs` - 13 edges

## Surprising Connections (you probably didn't know these)
- `Conversation engine (main)` --references--> `text()`  [INFERRED]
  docs/ARCHITECTURE.md → src/main/vrm-meta.ts
- `ADR-015 Character state machine lives in main (2026-10-29)` --references--> `AppState`  [INFERRED]
  docs/DECISIONS.md → src/shared/ipc.ts
- `run()` --calls--> `transition()`  [EXTRACTED]
  tests/unit/character.test.ts → src/shared/character.ts
- `start()` --calls--> `handle()`  [EXTRACTED]
  src/main/index.ts → src/main/ipc.ts
- `start()` --calls--> `on()`  [EXTRACTED]
  src/main/index.ts → src/main/ipc.ts

## Import Cycles
- None detected.

## Communities (47 total, 7 thin omitted)

### Community 0 - "main/index.ts"
Cohesion: 0.05
Nodes (42): ADR-015 Character state machine lives in main (2026-10-29), electron, devOrigin, devServerUrl, handle(), on(), trusted(), customPath() (+34 more)

### Community 1 - "devDependencies"
Cohesion: 0.13
Nodes (15): devDependencies, electron@45.1.0, electron-builder@26.18.0, eslint@10.13.0, react@19.3.1, @types/node@24.19.2, @types/react@19.3.0, @types/react-dom@19.3.0 (+7 more)

### Community 2 - "start"
Cohesion: 0.11
Nodes (22): CHARACTER_DEFAULT, CHARACTER_MAX, CHARACTER_MIN, clampSize(), defaultPlacement(), fitToDisplays(), overlap(), placeBeside() (+14 more)

### Community 3 - "Code Review and Quality"
Cohesion: 0.07
Nodes (29): 1. Correctness, 2. Readability & Simplicity, 3. Architecture, 4. Security, 5. Performance, Change Descriptions, Change Sizing, Code Review and Quality (+21 more)

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

### Community 14 - "security.ts"
Cohesion: 0.12
Nodes (14): vitest@5.0.5, vitest, APP_HOST, APP_SCHEME, devCsp(), isTrustedUrl(), PROD_CSP, resolveBundlePath() (+6 more)

### Community 15 - "electron-builder.yml"
Cohesion: 0.10
Nodes (19): appId, asar, directories, output, electronFuses, enableCookieEncryption, enableEmbeddedAsarIntegrityValidation, enableNodeCliInspectArguments (+11 more)

### Community 16 - "Security Checklist"
Cohesion: 0.11
Nodes (17): AI / LLM Security, Authentication, Authorization, CORS Configuration, Data Protection, Dependency Security, Destructive Path Operations, Error Handling (+9 more)

### Community 17 - "character.ts"
Cohesion: 0.07
Nodes (27): three@0.186.1, three, Avatar, loadAvatar(), Pose, POSES, VISEMES, applyState() (+19 more)

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
Cohesion: 0.21
Nodes (9): react-dom@19.3.1, react, react-dom, Chat(), onKeyDown(), send(), Message, Settings() (+1 more)

### Community 22 - "Testing Patterns Reference (JavaScript/TypeScript)"
Cohesion: 0.14
Nodes (13): API / Integration Testing, Common Assertions, E2E Testing (Playwright), Mock at Boundaries Only, Mock Functions, Mock Modules, Mocking Patterns, React/Component Testing (+5 more)

### Community 23 - "Decisions (ADR log)"
Cohesion: 0.11
Nodes (18): ADR-001 Electron over Tauri (2026-10-29), ADR-002 React instead of Vue (2026-10-29), ADR-003 No Python backend (2026-10-29), ADR-004 Privileged work only in main; sandboxed renderers (2026-10-29), ADR-005 OmniRoute not adopted (2026-10-29), ADR-006 Claude Code via hooks + headless CLI (2026-10-29), ADR-007 SQLite driver (pending, Milestone 5), ADR-008 Agent-skills subset instead of full plugin (2026-10-29) (+10 more)

### Community 24 - "Key modules"
Cohesion: 0.15
Nodes (12): Architecture, Character state machine (pure TS, renderer), Claude Code bridge, Conversation engine (main), Key modules, Memory, Plugin registry, tools, permissions, Repository layout (from Milestone 1) (+4 more)

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
Cohesion: 0.22
Nodes (9): Claude Code, Dependency policy, Development-tool risks (this repo), Electron baseline (enforced from Milestone 1), MCP, Secrets, Security, Threat model (short) (+1 more)

### Community 31 - "Current State"
Cohesion: 0.22
Nodes (9): Bugs found and fixed while testing (Milestone 1), Bugs found and fixed while testing (Milestone 2), Current State, Known issues / follow-ups, Milestone 2: character (new), Not verified (needs a person at the screen), Pending from Milestone 0, Verified this session (commands actually run) (+1 more)

### Community 32 - "Reference Research"
Cohesion: 0.25
Nodes (7): 1. AIRI (moeru-ai/airi): primary reference, 2. Xiaoke AI (liupig/xiaokeai), 3. YUI (yw0nam/YUI): ideas only (noncommercial license), Cross-cutting conclusions, Licensing summary (read first), Reference Research, Snapshot

### Community 34 - "Desktop Assistant: instructions for Claude Code"
Cohesion: 0.29
Nodes (6): Assets and licenses, Desktop Assistant: instructions for Claude Code, graphify, Security invariants (do not weaken), Stack and commands, Working rules

### Community 35 - "Installation"
Cohesion: 0.40
Nodes (4): Claude Code tooling (reproduce on another machine), Installation, Prerequisites, Troubleshooting

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

## Knowledge Gaps
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Decisions (ADR log)` connect `Decisions (ADR log)` to `main/index.ts`, `README.md`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **Are the 10 inferred relationships involving `start()` (e.g. with `main/index.ts` and `.characterBounds()`) actually correct?**
  _`start()` has 10 INFERRED edges - model-reasoned connections that need verification._
- **Should `main/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0518326545723806 - nodes in this community are weakly interconnected._
- **Why does `AppState` connect `main/index.ts` to `character.ts`, `react`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Why does `ADR-015 Character state machine lives in main (2026-10-29)` connect `main/index.ts` to `Decisions (ADR log)`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Should `start` be split into smaller, more focused modules?**
  _Cohesion score 0.10931174089068826 - nodes in this community are weakly interconnected._