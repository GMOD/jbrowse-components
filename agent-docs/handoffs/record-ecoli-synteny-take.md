---
name: record-ecoli-synteny-take
description: The E. coli synteny take is written, verified from the CLI and never shot — four turns that align two strains with minimap2 on camera and land on the LEE island. Everything it needs is in the tree; what is missing is a recording session on a Mac with the grants. Read before filming any agent-client clip, and before reaching for the Claude-app harness, which was tried and judged not showcase material.
---

# Record the E. coli synteny take

The take module and its plan are written and every number in them was checked
from the CLI; no take has been recorded. This file is the pointers a recorder
needs and the state that is not obvious from them. **Delete it when the clip
lands.**

Permanent homes, none of which this file repeats:

- The take itself —
  [`scripts/agent-demos/takes/ecoli_synteny.md`](../../scripts/agent-demos/takes/ecoli_synteny.md)
  (the pair, the pre-staging commands, what a good take does turn by turn, the
  verified numbers, and what was checked to write them) and
  `ecoli_synteny.mjs` beside it.
- The harness and every macOS trap —
  [`scripts/agent-demos/CLAUDE.md`](../../scripts/agent-demos/CLAUDE.md).
- The wider thread, including the two clips still wanted from other clients —
  [ideas/land-the-agent-client-demo-videos.md](../ideas/land-the-agent-client-demo-videos.md).
- Publishing a finished clip — `website/CLAUDE.md` § Videos, `externalClips` in
  `website/scripts/video-specs.ts`, and the embeds at the top of
  `website/docs/agents.md`.

## Use the TUI harness

`node scripts/agent-demos/recordDemoMac.mjs <outdir> scripts/agent-demos/takes/ecoli_synteny.mjs`

**Not `recordDemoApp.mjs`.** Filming Claude Code inside the Claude desktop app
was built and tried on 2026-09-08 and the output was judged not showcase
material; the harness section in `scripts/agent-demos/CLAUDE.md` says what it
costs and why, and its findings are recorded so nobody re-derives them. tmux
gives the TUI harness real text state, which is the whole difference.

## Before filming

Established on 2026-09-08, so a recorder need not rediscover it:

- **Quit `/Applications/JBrowse 2.app`.** It is 4.3.0, which serves no MCP
  bridge at all, and the harness's own guard only connect-tests the socket — so
  a running installed app passes the guard while the take films the repo build
  beside it. An agent driving one app while an operator watches the other is
  how a session claimed to have opened hg38 over an app that never moved.
- `pnpm --filter @jbrowse/desktop build` first; the harness serves `build/` and
  points the client at `build/mcpServer.js`.
- The terminal running the harness needs both Accessibility and Screen
  Recording. Screen Recording fails silently into wallpaper-only frames.
- `tmux`, `ffmpeg`, `claude`, `minimap2` and the repo CLI were all present and
  on PATH on this machine; the take runs in a terminal, so it inherits the
  shell environment and the fnm-shimmed `jbrowse` resolves.
- Stage the two FASTAs into `<outdir>/cwd` first — the curl commands are in the
  take's own plan doc, about a second, 1.5 and 1.8 MB.
- **Shoot `takes/smoke.mjs` first.** One turn against hosted hg38, and it proves
  the whole loop before ten minutes are spent. It was reworded on 2026-09-08 to
  ask for "hg38" and "BRCA1" rather than a config URL and coordinates, which is
  what a viewer would type and what `docs topic:"hosted-data"` exists to answer.
- Check the account's weekly usage before a four-turn take: it was flagged as
  approaching its limit on 2026-09-08.

## What is still open

- **Turn four's phrasing.** The plan doc's own Open section weighs "name them"
  against "take me to the most interesting one"; the take module currently asks
  the second, because it puts the LEE island on camera rather than ending on a
  list. Worth deciding from the first take rather than in advance.
- **Whether the whole-genome view reads at all at this window size.** The plan
  turns the gene tracks off for turn one and collapses the empty rows, which is
  right for the ribbons, but no frame of it has been seen.
- **The clip's name and frame.** `mcp/agent_ecoli_take1` follows the four
  already registered; `width`/`height` in `externalClips` come from the encode,
  not from a guess.

## When it lands

Register it in `externalClips`, embed it in `website/docs/agents.md`, then
`pnpm figures:push` and commit `media.lock` — `website/CLAUDE.md` § Videos has
the order and the reason a push before the embed 404s. Update the "Open"
section of
[`takes/ecoli_synteny.md`](../../scripts/agent-demos/takes/ecoli_synteny.md),
which currently says the take has never been shot, and delete this file.
