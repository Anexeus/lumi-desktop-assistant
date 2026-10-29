# Third-party notices

## Seed-san (default character model)

- File: `src/renderer/public/models/Seed-san.vrm` (SHA-256 `624d0d554bc205bbdc33e22a68a2c3c20edebb3e573011ead8878a65e5329b23`)
- Source: https://github.com/vrm-c/vrm-specification/tree/master/samples/Seed-san
- Copyright: VirtualCast, Inc.
- License: VRM Public License 1.0, https://vrm.dev/licenses/1.0/
- Terms embedded in the model (read from its `VRMC_vrm.meta` on 2026-10-29): avatar use by everyone,
  commercial use allowed (`corporation`), redistribution allowed, modification and redistribution of
  modifications allowed, **credit required** (`creditNotation: required`).
- Credit is shown in the app under Settings → Character model.

## Claude Code skills (development only, not shipped)

`.claude/skills/` contains skills from https://github.com/addyosmani/agent-skills (MIT, see
`.claude/references/LICENSE-addyosmani-agent-skills.txt`) and the Graphify skill
(https://github.com/Graphify-Labs/graphify, Apache-2.0).

## npm packages

Shipped runtime code is bundled from MIT/Apache-2.0 packages (Electron, React, three, @pixiv/three-vrm,
zod). Their licenses are included in the packaged app's `node_modules` or bundled output headers.
