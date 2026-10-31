# Upgrade progress (2026-10-30 brief: repair, computer use, voice, local AI, UI, installer)

Each phase records what changed, what was checked in this session, and what is left. "Verified" means it was run here.

## Phase 1: audit and dev startup

**Project root:** `C:\Users\Admin\Documents\Projects\Desktop Assistant` (has `package.json`, `package-lock.json`, `node_modules`).
Node 24.22.2 at `%LOCALAPPDATA%\Programs\node-v24.22.2-win-x64`. Machine: i7-13700HX, 16 GB RAM, RTX 4050 Laptop (6 GB).

**Root causes of "npm run dev doesn't work":**
1. `npm run dev` was run in `C:\Users\Admin`, where there is no `package.json` (ENOENT). Not a project defect.
2. In PowerShell, `npm` resolves to `npm.ps1`, which the default execution policy blocks. `npm.cmd` works.
3. A second copy of Lumi (installed or another dev run) makes the new one exit silently (single-instance lock on the
   shared profile). Now it prints why, and the running copy comes to the front with its chat open.

**Verified:** `npm.cmd run dev` from the project root builds main/preload, serves the renderer on :5173 and starts
Electron; Lumi started `ollama.exe serve` hidden (no Ollama app window) and it answered on :11434.

**Audit (state before this upgrade):**
| Area | State |
|---|---|
| Electron shell, sandboxing, IPC validation | works (E2E) |
| Character, gestures, drag physics, voices per character | works; framing clipped raised arms (fixed); transparent area could get stuck blocking clicks (fixed) |
| Chat, memory, history, Markdown | works |
| Local AI | needs a separately installed Ollama (qwen3:4b + lfm3-audio) |
| Online AI | one OpenAI-compatible endpoint + key bound to its origin; no provider presets |
| Voice | push-to-talk and hands-free mode via Ollama's lfm3-audio STT/TTS; Windows voices as TTS fallback |
| Screen understanding | missing |
| Desktop control | only Lumi's own browser window, apps allow-list, notes/files writes |
| Terminal / project commands | missing (by design: no shell) |
| Installer | NSIS, unsigned, builds; not installed on this PC |

## Phase 14: mouse-wheel resize (done first: smallest, self-contained)
- The purple grip is removed. Scrolling over her (the only place the click-through window receives the wheel) scales
  her proportionally around her feet, eased over a few frames, within 160×210…900×1181-ish limits (the old size limits,
  kept proportional). `+`/`−` keys use the same path. Size is saved when the gesture settles (existing persistence).
- Ctrl+wheel never zooms the page (`preventDefault`, non-passive listener).
- **Verified:** unit tests for `scaleBounds` (grow, shrink, limits keep proportions); E2E with real wheel events in the
  Electron window: grows past 400 px wide, aspect kept, feet move ≤ 2 px, shrink stops at the minimum, no grip element.

## Phase 6: Qwen3 without Ollama (done)
- Bundled engines (MIT): llama.cpp **b11982** Vulkan x64 (`llama-server.exe`, GPU on NVIDIA/AMD/Intel, CPU fallback) and
  whisper.cpp **b5454** x64 (`whisper-server.exe`, CPU). Fetched by `npm run runtimes` (SHA-256 from the GitHub release
  digests), installed to `resources\runtimes` in the app. Models are not bundled (2.7 GB would make a fragile installer):
  Settings downloads them to `%APPDATA%\Desktop Assistant\models\local` with resume, mirror fallback (hf-mirror.com) and
  SHA-256 verification against the publisher's values; Remove deletes them.
- Models: Qwen3-4B Q4_K_M (2.5 GB, Apache-2.0), Qwen3-1.7B Q8_0 (1.8 GB), whisper small.en q5_1 (190 MB), base.en q5_1 (60 MB), MIT.
- The chat server listens on 127.0.0.1 on a random port with a random API key (other programs can't use it), picks the
  dedicated GPU (the iGPU reports shared RAM, so "most memory" alone picked it: fixed and unit-tested), offloads layers
  automatically (`-ngl auto`), retries on CPU if the GPU path fails, and runs Qwen3 with thinking off (5× faster tasks).
- Whisper server gets a vocabulary prompt (Lumi, VS Code, npm, TypeScript, PowerShell…) and answers on the OpenAI path.
- **Verified (live, no Ollama):** engine ready on the RTX 4050 in ~6 s; "What is 17 times 3?" → "17 times 3 is 51." (4 s);
  whisper transcribed a test sentence word for word in 2.5 s; tool calls work; models downloaded and verified here.
- **Fixed on the way:** an empty address made a settings check throw and froze startup (found through the new log);
  text cut mid-emoji made llama.cpp reject requests (lone UTF-16 surrogates now replaced before sending).

## Phase 7: online providers (done, unverified against real keys)
Gemini, Groq, OpenAI, Anthropic, OpenRouter and custom, all through their OpenAI-compatible endpoints. One DPAPI-encrypted
key per provider (a key saved before this is moved to its provider), masked, removable. Cloud warning in Settings.
"Free tier" wording names no numbers: limits are per account. **No API key was available, so no cloud call was tested.**

## Phases 2–3: screen understanding and desktop control (done)
- `resources\scripts\desktop.ps1` (fixed, bundled) runs as one long-lived helper: UI Automation (windows, numbered
  controls, invoke/set/toggle/expand/select), Windows OCR, SendInput (typing, key combos, clicks, wheel), per-monitor DPI
  aware (physical pixels). Lumi sends structured JSON operations only.
- Tools: screen_look, windows_list, window_control, ui_act, ui_type, keys_press, mouse_click, mouse_scroll, and
  screen_picture (a screenshot to a vision-capable cloud model, only with "Let cloud AI see screenshots" on).
  Every action re-reads the window and returns it, so "clicked" is never reported as "done" without evidence.
- Status: the island turns red ("Lumi is using your PC · tap to stop"). Emergency stop: Ctrl+Alt+Shift+X, tray, or the
  island; it cancels the reply, pending approvals and the helper. Disable via the plugin switch.
- **Verified:** helper lists windows and controls; live: "Open Notepad and type this text into it: Hello from Lumi" with
  the built-in Qwen3 → done in 5–6 s, twice; the Notepad document was checked through UI Automation independently;
  E2E: screen_look asks first and reports the real window; the emergency stop clears a pending approval.
- **Not working on this PC:** Windows OCR fails inside `RecognizeAsync` (E_FAIL) even on a synthetic image; this Windows
  build ("Aspect 11X / NanoWin") appears to have the OCR data removed. Lumi says "OCR failed" instead of guessing.
  Calculator is not installed on this build either. Electron/Chromium windows expose few UI Automation controls.

## Phase 4: coding and terminal (done)
- project_info (verifies package.json, lists scripts, detects the package manager), project_run (only scripts that exist
  in that package.json; node + npm-cli.js with an explicit cwd and no shell; exit code + output; 15-minute limit; dev
  servers keep running as tracked jobs), project_jobs, project_stop (kills the process tree), project_open (VS Code or
  Windows Terminal in the folder). Projects must be inside an approved folder. No arbitrary commands, by design.
- **Verified:** unit tests run real npm scripts in a temp project (exit 0 with output; exit 3 reported as FAILED;
  undefined scripts and folders outside approval refused); E2E: a folder without package.json is refused before asking.

## Phase 5: voice (done)
Whisper on this PC as the default speech-to-text for new installs; non-speech markers ("[BLANK_AUDIO]", "(music)") are
dropped instead of sent; repeated identical utterances within 5 s are ignored; "Didn't catch that" feedback; an optional
wake word (the assistant's name); an unplugged mic ends voice mode with a message. Push-to-talk, hands-free mode and text
stay. **Not done:** interrupting Lumi by talking over her (audio is ignored while she speaks, which also prevents
self-hearing; Stop and the emergency stop interrupt her), streaming partial transcripts.

## Phase 8 and 10: UI, stability (done)
Provider cards, local model manager with progress/pause/remove, engine status (GPU/CPU), red controlling state,
diagnostic log at `%APPDATA%\Desktop Assistant\logs\lumi.log` (rotated at 1 MB, keys masked), helper restarts after a
hang, servers and jobs stopped on quit, up to 10 tool rounds, one retry after an empty model reply.

## Phase 9: tooling
No new plugins or MCP servers were installed: the repo already has typescript-lsp, frontend-design, ponytail, graphify
and agent-skills, and none of the runtime needs (UI Automation, inference, speech) can come from a Claude Code plugin.
Context7 is configured but needs authentication (`/mcp` in Claude Code) before it can be used.

## Phase 11–12: tests and installer
| Check | Result (this session) |
|---|---|
| `npm run typecheck`, `npm run lint` | pass |
| `npm test` | 143 pass + 2 opt-in skipped |
| `npm run test:e2e` | 50/50 |
| `npm run package` | `release\Lumi Setup 0.2.0.exe` (210 MB, unsigned); 0.1.0 kept in `release\previous` |
| Silent install → launch → log | installed to `%LOCALAPPDATA%\Programs\Lumi`; started cleanly; your settings migrated (still Ollama) |
| Uninstall | removes the app; keeps `%APPDATA%\Desktop Assistant` (settings, chats, 2.7 GB of models); reinstall works |
| Live built-in AI, Whisper, Notepad control | see Phases 6 and 2–3 |
| Not tested | real microphone in a real room; cloud providers (no keys); a clean second PC; code signing (no certificate) |

## 0.2.1: testing the installed app found three bugs (fixed)
Tested the real installed `Lumi.exe` (launched with `--force-renderer-accessibility`, driven through Lumi's own UI
Automation helper like a person: typing in the chat box, clicking "Allow once").
1. **Tool calls written as text.** Qwen3 sometimes wrote `apps_open {"name": "Notepad"}` as a reply instead of calling the
   tool, so nothing happened. Fixed twice over: Qwen's recommended non-thinking sampling (temp 0.7, top-p 0.8, top-k 20)
   instead of llama.cpp's defaults, and a parser that turns a written call for a real tool into a call (still approved).
2. **Typing landed in Lumi.** Clicking "Allow once" focuses Lumi's chat, so typing "where the focus is" went into Lumi.
   The helper now treats the topmost window that isn't Lumi's as the target and brings it back before typing or keys.
3. **Non-English text was mangled** on its way to the helper (PowerShell read stdin as the OEM code page). Now UTF-8.
- **Verified in the installed app (built-in engine, Ollama stopped):** "What is 17 times 3?" → "17 times 3 is 51." (~6 s);
  "Open Notepad and type this text into it: Hello from Lumi" with real approvals → 3/3 runs, Notepad's document checked
  independently each time (9–11 s). Unit 144 pass, E2E 50/50.

## 0.3.0: "too slow, nothing works, cmd windows" (fixed)
Root causes found by testing on this PC, not guessed:
1. **Console windows:** Lumi started Ollama detached, so each helper Ollama launched (GPU probe, device list, runners)
   opened its own console window (seen in a process trace: a new `conhost.exe` per child). Ollama is now attached to
   Lumi's hidden console.
2. **Nothing working:** the database's indexes were damaged (after force-kills during testing), so startup failed and
   the windows had no handlers. Repaired with REINDEX (all chats and settings kept, backup in
   `%APPDATA%\Desktop Assistant\db-backup-before-repair`); the store now checks and repairs this at every start;
   `Lumi.exe --quit` exits cleanly.
3. **Slow / stuck:** the model repeated slightly wrong tool arguments ("YouTube", "1", `index`) until the step limit.
   Arguments are now normalised, and errors show the expected shape. The built-in model is now Qwen3-VL 4B Instruct.
   Measured: answer 3.6 s; "open Notepad and type" 5.1 s; "open YouTube and play a lofi song" 10.7 s, video playing.
4. **Approval cards:** "Do what I ask without asking first" (on for the owner). **Settings** moved into the chat
   window with tabs. **Ad blocker** in Lumi's browser (doubleclick and YouTube ad pings blocked; pages and video
   streams allowed — checked against the real filter lists).
5. New: `PROJECT_SUMMARY.md` (whole-project summary and handoff) and `AGENTS.md` (for any AI coding agent).

## 0.3.1: one icon everywhere, install location, settings diagnosis
- The Lumi icon (build/icon.png, same art as the exe and installer) is now used by every window (taskbar, Alt+Tab),
  the tray, notifications and the title-bar mark.
- The installer has a "Choose Install Location" page (`allowToChangeInstallationDirectory`); verified on screen.
- Slowness report: the owner's settings had reverted to Ollama (slow thinking model, GPU model swaps, approval cards),
  cause not found. Restored, and each start now logs `Settings: ai=… model=… stt=… autoApprove=…` to lumi.log.
  Timed on a copy of the real profile: reply 1.6 s (0.5 s with voice off). Measurements taken while forcing Chromium
  accessibility (for UI Automation testing) were 10× slower and are not representative.
- Unit 146 pass, E2E 50/50.

## 0.4.0: taskbar-glass island, Siri orb, rebindable keys, peeking and sitting, cute lines
- **Island:** OS Acrylic blur like the taskbar (probed: CSS can't blur the desktop, a custom pill shape is ignored on
  Acrylic windows), neutral tint, no colours; the green dot became a Siri-style orb (pops in, spins faster while
  thinking, swells with the voice, red while Lumi controls the PC). Checked on screen over a striped backdrop.
- **Keyboard shortcuts** can be changed in Settings → General (E2E: record, refuse a duplicate, reset; registration
  checked through `globalShortcut.isRegistered`).
- **Peeking:** dropped near the left/right edge she leans in from behind it. **Sitting:** dropped on a window's top edge
  she sits on it, follows it when it moves, and falls when it is minimised. Verified with a stand-in window in another
  process: sat at y 180 (430 − 0.62 × 404), followed a +120/−70 move exactly, fell to y 508 (bottom) when minimised.
- **Cute lines:** "Hi hi!", "Yay!", "Hee hee!", "Peekaboo!", "Whoa!", a cheer when an action worked; higher-pitched;
  they now fall back to the Windows voice (with the built-in engine they used to be silent).
- **Fixes:** settings no longer all reset when one saved value is invalid (ADR-055); the character no longer grows a few
  pixels per launch at 125 % scaling; lopsided models are centred on their body; a missing AI voice is not retried per
  sentence.
- New: `OTHERAGENT.md` (the whole story for the next AI agent).
- Typecheck and lint clean; unit 158 pass (2 skipped); E2E 51/51 (new: rebinding a shortcut in Settings).

## 0.5.0: pill island, glass menu, guided API keys, 9 characters, side-on sitting, smoother resizing
- **Island:** a smaller near-black pill with round ends (300×36), the default; "Frosted glass" stays as an option
  (Settings → General → Island look). Real blur in a pill shape was probed four ways and is impossible on Windows here
  (ADR-056). Checked on screen: pill, pill opened, glass.
- **Menu:** the character's and tray's right-click open Lumi's own black-glass menu (orb + status, icons, Keep-on-top
  switch, Stop with its shortcut, Quit); keyboard and Esc work; only the menu window may run items (E2E).
- **API keys:** Settings → AI → an online provider shows "Connect <provider>" in three steps; "Get a key" opens the
  provider's key page (fixed list), saving the key tests the connection at once (E2E: Gemini's key page opens).
- **Characters:** Vita, Bibi, Victoria Rubin, Darkness Shibu added (CC0). "Find Miku / Find Teto / Browse VRoid Hub"
  links for models that can't be bundled. All 9 rendered standing and sitting on screen.
- **Sitting:** works on all 9 (stand-in window: hips on the edge at y 182 for each); now side-on so skirts stay modest;
  the taskbar is a seat (E2E: hips on the work-area edge within 2 px); wider drop tolerance.
- **Wheel resize:** renders immediately on each resize (a cleared canvas used to fail the hit test, turning the window
  click-through mid-scroll so the scroll went to the app behind), stays clickable 0.7 s after each notch, handles mice
  that report lines, and wobbles like jelly when she grows or shrinks.
- Typecheck and lint clean; unit 159 pass (2 skipped); E2E 55/55 (new: menu, island look, key page, taskbar seat).

## 0.6.0: the AI does what it's told; one look everywhere; taskbar icon; front-facing sit
- **AI acting (driven with the real local models, isolated profile, auto-approve on, audio muted, Documents redirected):**

  | Request | Built-in Qwen3-VL 4B | Ollama qwen3:4b |
  |---|---|---|
  | Open YouTube and play a song | played a lofi video (15.7 s) | play_video: "1 A.M Study Session" (40 s) |
  | Open VS Code (not installed here) | said so, offered Visual Studio 2022 | same |
  | Open my Downloads folder | opened (1.6 s) | opened (7.7 s) |
  | Write a short paragraph about cats | written, opened in Notepad (4.6 s) | same (18.5 s) |

  Before: links instead of actions, and "set up your project folder in Settings → Tools". `whatsapp_message` is unit
  tested (link) but was not run against a real account (it would message a real person).
- **Database:** rollback journal instead of WAL after recent chats were lost with a missing -wal file (ADR-061).
- **Taskbar icon:** a dev `Electron.lnk` shared Lumi's app id; removed, dev runs now use their own id (ADR-062).
- **Look:** chat and Settings in the island's black glass with white accents (ADR-063); island hides the model name
  unless Settings → General → "Show the AI model on the island" is on; the menu has "Change character" (all 9 listed).
- **Sitting:** facing the viewer on the window's edge again (ADR-064).
- Typecheck and lint clean; unit 161 pass (2 skipped); E2E 57/57 (new: island model setting, menu character change, installed-app lookup).

## 0.7.0: Gemini voice fix, Miku by default, Desktop Mate–style poses, install apps, never asks
- **Gemini:** "Transcription failed (404)" fixed (Whisper fallback). Gemini's error messages are now shown. In the
  installed app Gemini then said "Missing or invalid Authorization header": the owner's saved key can't be decrypted
  (it wasn't encrypted with the key in their profile's `Local State`, which encrypts and decrypts new keys across
  restarts), so no key was sent. Lumi now drops such a key and the chat says to paste it again (ADR-069).
- **Characters:** Hatsune Miku (RemiX3) bundled and the default; the owner's KuroG model is their personal model (its
  licence forbids redistribution, so it cannot ship).
- **Poses** checked on screen with Miku: picked up (dangling), sitting on a window and on the taskbar (hips on the edge,
  y 182 and 664), peeking (half shown). Title-bar orb checked.
- **Clicks:** single → menu, double → Settings. **app_install** (winget; parser unit-tested; winget on this PC is broken
  and reports how to repair it). Approvals off by default. Installer refuses 32-bit Windows with a message.
- Typecheck and lint clean; unit 162 pass (2 skipped). E2E 58 tests: 57 passed in the full run; the shortcut-reset test
  failed only because the installed Lumi held `Alt+Shift+Space`, and passed when re-run with it closed. New E2E: an
  undecryptable saved key is dropped and the chat asks for it again.
- **Second pass (owner's screenshots):** Gemini with a new key → "not available, ollama pull": the 2.5 models are legacy
  at Google; default now `gemini-3.6-flash`, checked live through Lumi with the owner's saved key ("ok" in 2.6 s), and
  a cloud 404 says to pick another model (ADR-070). Held: no idle gestures (a "stretch" had put her arms overhead),
  pendulum swing, kicking legs. One click waves, double click opens Settings, right-click opens the menu. Taskbar:
  knees-up `floor` perch; measured with Miku and the owner's model, soles on the taskbar line (0 and ~6 px below);
  hair and a sash hang lower (ADR-071).
- Typecheck and lint clean; unit 162 pass (2 skipped); E2E 59/59 with the installed Lumi closed (new: one click only
  waves, a double click opens Settings, neither opens the menu; the taskbar seat is `floor`).

## 0.8.0 (first part, built as 0.7.1, not released): legs in front of the taskbar, the first pick-up back, own models, Gemini tools, Mate Engine ideas, island fixes
- **Gemini tools:** "400 Function call is missing a thought_signature" after a tool call (the owner's `apps_open`): Lumi
  now returns Gemini 3's `extra_content` signature with each tool call (ADR-072). Checked live through Lumi with the
  owner's saved key on a throwaway profile copy, windows hidden: `files_search` → its result → a reply, 8.3 s, no error.
- **Taskbar:** she sits on its edge with her legs hanging in front of it again; her window is at `pop-up-menu`, above the
  taskbar (Electron's `floating` is below it). Checked with the owner's model: perch `sit`, window bottom at y 1064 over
  the taskbar top at 912, on top; a crop of only the taskbar strip shows her legs over it.
- **Picked up:** the first dangling pose is back (no pendulum), as the owner asked.
- **Own models:** any number, in Settings → Character and the right-click menu, removable; the old `custom.vrm` joins
  them at start. On the owner's PC: KuroG's model, 止丸式初音ミクNT and "Miku 2" (all personal: their licences forbid
  redistribution). `HatsuneMikuNT.vrm` was taken out of the bundled models (ADR-073).
- **Mate Engine ideas, own code (ADR-073):** head, neck and chest follow the cursor; stroking her head is a head pat;
  after 3 idle minutes she naps and wakes with a stretch. Captured on screen (Miku): looking left-up and right-down,
  petted (eyes-closed smile, tilt), asleep (eyes shut, head drooped), waking stretch. No Mate Engine code or assets.
- **Island:** a tap while she thinks or talks stops her; the speech detector hears softer voices (0.01 RMS); a Windows
  voice can no longer leave her stuck "speaking"; transcription failures are logged (ADR-074). With the name check on,
  the island says it is listening for "Lumi, …" and reports ignored speech. The quick-ask mic button no longer turns
  white (icon invisible) on hover; measured in the built app: 18 % white with the light icon, Send unchanged.
- **Two profiles found:** a Lumi started from Claude's tools used a copy of the profile inside Claude's MSIX package.
  The owner's real profile (Start menu) is on Ollama with the name check on, the likely cause of "the island doesn't
  hear me". Whisper was hard-linked into the real profile, so voice works there with Gemini. Installed at
  `C:\Users\Admin\Documents\Lumi`; the real Start-menu and desktop shortcuts and the uninstall entry show 0.7.1.
- Typecheck and lint clean; unit 165 pass (2 skipped); E2E 62/62 with the installed Lumi closed (new: head pat and nap,
  tapping the island stops her, the name-check hints).

## 0.8.0: Mate Engine's animations, sounds and avatars; one icon; voice answers without her name
- **Voice ("Got it…" and then nothing):** the owner's real profile has the name check on; tapping the island now counts
  as addressing her for the first sentence and for follow-ups within 30 s of her answer (ADR-077). Their real log had no
  transcription errors, which pointed at the check, not speech-to-text.
- **Icon:** the UI's orb is now the icon of the exe, installer, taskbar, tray and windows (ADR-076).
- **Mate Engine (ADR-075):** imported from the owner's copy, never shipped: 56 clips (19 idles, male idles, picked up,
  two edge sits, sleeping, head pat, six reactions, 12 dances), 14 sounds, 3 avatars. Converter calibrated against the
  clips' own hand/foot goals (mean 0.08 of centre-of-mass height; under 0.1 in a unit test). Checked on screen with Miku:
  idles natural and on the ground; picked up (lifted, limp); sitting on the taskbar facing the viewer with the legs
  hanging; a click reaction; dancing; asleep on the floor; peeking keeps Lumi's lean. "Dance" in the menu.
- **Found while testing:** a Lumi started from Claude's tools runs on a copy of the profile inside Claude's MSIX package;
  the owner's real profile is reached via Explorer (OTHERAGENT 4.12).
- Typecheck and lint clean; unit 172 pass (2 skipped; new: the muscle converter, including the local calibration
  check); E2E 66/66 with the installed Lumi closed (new: `mate.spec.ts`, a made-up Mate Engine folder imported at launch,
  clips per situation, Dance, the clip/sound access rules, Settings; the API-surface test lists the new `mate` API).
