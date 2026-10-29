# Graph Report - Desktop Assistant  (2026-10-29)

## Corpus Check
- 65 files · ~46,314 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: .css 4, (none) 3, .tsbuildinfo 2)

## Summary
- 733 nodes · 891 edges · 38 communities (35 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- main/index.ts
- package.json
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
- Hardening Patterns
- electron-builder.yml
- Security Checklist
- main.ts
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

## God Nodes (most connected - your core abstractions)
1. `start()` - 21 edges
2. `Code Review and Quality` - 19 edges
3. `WindowManager` - 18 edges
4. `compilerOptions` - 15 edges
5. `Security Checklist` - 15 edges
6. `Test-Driven Development` - 15 edges
7. `compilerOptions` - 14 edges
8. `Decisions (ADR log)` - 14 edges
9. `Browser Testing with DevTools` - 13 edges
10. `Documentation and ADRs` - 13 edges

## Surprising Connections (you probably didn't know these)
- `start()` --calls--> `handle()`  [EXTRACTED]
  src/main/index.ts → src/main/ipc.ts
- `start()` --calls--> `on()`  [EXTRACTED]
  src/main/index.ts → src/main/ipc.ts
- `start()` --calls--> `hardenSession()`  [EXTRACTED]
  src/main/index.ts → src/main/security.ts
- `start()` --calls--> `hardenWebContents()`  [EXTRACTED]
  src/main/index.ts → src/main/security.ts
- `start()` --calls--> `serveBundle()`  [EXTRACTED]
  src/main/index.ts → src/main/security.ts

## Import Cycles
- None detected.

## Communities (38 total, 3 thin omitted)

### Community 0 - "main/index.ts"
Cohesion: 0.06
Nodes (41): electron, devOrigin, devServerUrl, handle(), on(), trusted(), APP_HOST, APP_SCHEME (+33 more)

### Community 1 - "package.json"
Cohesion: 0.05
Nodes (48): shared, dependencies, zod@4.6.7, description, devDependencies, electron@45.1.0, electron-builder@26.18.0, electron-vite@6.0.0 (+40 more)

### Community 2 - "start"
Cohesion: 0.12
Nodes (19): CHARACTER_DEFAULT, CHARACTER_MAX, CHARACTER_MIN, clampSize(), defaultPlacement(), fitToDisplays(), overlap(), placeBeside() (+11 more)

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
Cohesion: 0.08
Nodes (24): AI / LLM features, Always Do (No Exceptions), Ask First (Requires Human Approval), Authentication and sessions, Common Rationalizations, Dependencies and supply chain, Destructive operations on derived paths, Hardening Controls (+16 more)

### Community 11 - "Documentation and ADRs"
Cohesion: 0.09
Nodes (22): ADR Lifecycle, ADR Template, API Documentation, Architecture Decision Records (ADRs), Changelog Maintenance, Common Rationalizations, Document Known Gotchas, Documentation and ADRs (+14 more)

### Community 12 - "Incremental Implementation"
Cohesion: 0.09
Nodes (22): Common Rationalizations, Contract-First Slicing, Implementation Rules, Increment Checklist, Incremental Implementation, Overview, Red Flags, Risk-First Slicing (+14 more)

### Community 13 - "Debugging and Error Recovery"
Cohesion: 0.09
Nodes (21): Build Failure Triage, Common Rationalizations, Debugging and Error Recovery, Error-Specific Patterns, Instrumentation Guidelines, Overview, Red Flags, Runtime Error Triage (+13 more)

### Community 14 - "Hardening Patterns"
Cohesion: 0.10
Nodes (18): Broken Access Control, Broken Authentication, Cross-Site Scripting (XSS), Data Classification, Dependency Audit Triage, Destructive Operations on Derived Paths, File Upload Safety, Hardening Patterns (+10 more)

### Community 15 - "electron-builder.yml"
Cohesion: 0.10
Nodes (19): appId, asar, directories, output, electronFuses, enableCookieEncryption, enableEmbeddedAsarIntegrityValidation, enableNodeCliInspectArguments (+11 more)

### Community 16 - "Security Checklist"
Cohesion: 0.11
Nodes (17): AI / LLM Security, Authentication, Authorization, CORS Configuration, Data Protection, Dependency Security, Destructive Path Operations, Error Handling (+9 more)

### Community 17 - "main.ts"
Cohesion: 0.12
Nodes (12): Application Plugin Registry (design), Enforcement, Lifecycle, Manifest, Planned built-ins, Scope (v1), canvas, grip (+4 more)

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
Cohesion: 0.22
Nodes (9): react-dom@19.3.1, react, react-dom, Chat(), onKeyDown(), send(), Message, Settings() (+1 more)

### Community 22 - "Testing Patterns Reference (JavaScript/TypeScript)"
Cohesion: 0.14
Nodes (13): API / Integration Testing, Common Assertions, E2E Testing (Playwright), Mock at Boundaries Only, Mock Functions, Mock Modules, Mocking Patterns, React/Component Testing (+5 more)

### Community 23 - "Decisions (ADR log)"
Cohesion: 0.14
Nodes (14): ADR-001 Electron over Tauri (2026-10-29), ADR-002 React instead of Vue (2026-10-29), ADR-003 No Python backend (2026-10-29), ADR-004 Privileged work only in main; sandboxed renderers (2026-10-29), ADR-005 OmniRoute not adopted (2026-10-29), ADR-006 Claude Code via hooks + headless CLI (2026-10-29), ADR-007 SQLite driver (pending, Milestone 5), ADR-008 Agent-skills subset instead of full plugin (2026-10-29) (+6 more)

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
Cohesion: 0.20
Nodes (5): Milestone 1 plan (implemented 2026-10-29; kept for reference), Roadmap, Desktop Assistant, Docs, Run it

### Community 29 - "scripts"
Cohesion: 0.20
Nodes (10): scripts, build, dev, lint, package, package:dir, preview, test (+2 more)

### Community 30 - "Security"
Cohesion: 0.22
Nodes (9): Claude Code, Dependency policy, Development-tool risks (this repo), Electron baseline (enforced from Milestone 1), MCP, Secrets, Security, Threat model (short) (+1 more)

### Community 31 - "Current State"
Cohesion: 0.25
Nodes (7): Bugs found and fixed while testing, Current State, Known issues / follow-ups, Not verified (needs a person at the screen), Pending from Milestone 0, Verified this session (commands actually run), What exists

### Community 32 - "Reference Research"
Cohesion: 0.25
Nodes (7): 1. AIRI (moeru-ai/airi): primary reference, 2. Xiaoke AI (liupig/xiaokeai), 3. YUI (yw0nam/YUI): ideas only (noncommercial license), Cross-cutting conclusions, Licensing summary (read first), Reference Research, Snapshot

### Community 34 - "Desktop Assistant: instructions for Claude Code"
Cohesion: 0.29
Nodes (6): Assets and licenses, Desktop Assistant: instructions for Claude Code, graphify, Security invariants (do not weaken), Stack and commands, Working rules

### Community 35 - "Installation"
Cohesion: 0.40
Nodes (4): Claude Code tooling (reproduce on another machine), Installation, Prerequisites, Troubleshooting

## Knowledge Gaps
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `three` connect `package.json` to `main.ts`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **Are the 10 inferred relationships involving `start()` (e.g. with `main/index.ts` and `.characterBounds()`) actually correct?**
  _`start()` has 10 INFERRED edges - model-reasoned connections that need verification._
- **Should `main/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05555555555555555 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.05224963715529753 - nodes in this community are weakly interconnected._
- **Should `start` be split into smaller, more focused modules?**
  _Cohesion score 0.11561561561561562 - nodes in this community are weakly interconnected._
- **Should `Code Review and Quality` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._
- **Should `Test-Driven Development` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._