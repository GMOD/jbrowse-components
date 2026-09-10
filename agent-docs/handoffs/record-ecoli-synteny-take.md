---
name: record-ecoli-synteny-take
description: The E. coli synteny take is written, verified from the CLI on two machines and never shot — four turns that align two strains with minimap2 on camera and land on the LEE island. Everything it needs is in the tree and it runs on either platform's TUI harness. Read before filming any agent-client clip, and before reaching for the Claude-app harness, which was tried and judged not showcase material.
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

## Use the TUI harness, on either platform

`node scripts/agent-demos/recordDemoMac.mjs <outdir> scripts/agent-demos/takes/ecoli_synteny.mjs`
on macOS, or `recordDemoTui.mjs` with the same two arguments on GNOME/Wayland.
**This take is not Mac-only**, whatever an earlier draft of this file said: both
harnesses film the real Claude Code TUI in a terminal beside the app, and the
Linux one took the take module, the `SYSTEM(cwd)` contract and the
`start-session.sh` invocation on 2026-09-09 — before that it carried its own
hardcoded BRCA1 `STEPS` and sent the whole `claude` command down `send-keys`,
which a system prompt this long does not survive.

**Not `recordDemoApp.mjs`.** Filming Claude Code inside the Claude desktop app
was built and tried on 2026-09-08 and the output was judged not showcase
material; the harness section in `scripts/agent-demos/CLAUDE.md` says what it
costs and why, and its findings are recorded so nobody re-derives them. tmux
gives the TUI harness real text state, which is the whole difference.

## Before filming

Established on 2026-09-08, so a recorder need not rediscover it, except the last
line, which is 2026-09-09:

- **Quit `/Applications/JBrowse 2.app`.** It is 4.3.0, which serves no MCP
  bridge at all, and the harness's own guard only connect-tests the socket — so
  a running installed app passes the guard while the take films the repo build
  beside it. An agent driving one app while an operator watches the other is
  how a session claimed to have opened hg38 over an app that never moved.
- `pnpm --filter @jbrowse/desktop build` first; the harness serves `build/` and
  points the client at `build/mcpServer.js`.
- **macOS**: the terminal running the harness needs both Accessibility and
  Screen Recording. Screen Recording fails silently into wallpaper-only frames.
- **GNOME/Wayland**: `ydotoold` has to be running with a socket you own, and
  seat0's active session has to be yours — the harness refuses to start
  otherwise, which is the check that separates a clear error from an hour of
  chasing the input stack. `scripts/agent-demos/CLAUDE.md` § "Linux:
  `recordDemoTui.mjs`" has the rest, including the tiling-extension handling.
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
- **The take's numbers hold on a second machine.** A fresh run of its own
  commands on Linux gives the same 83 records, the same 4.04 Mb of matched
  bases, the same 19 islands of 10 kb or more totalling 703,048 bp, and the LEE
  island at the coordinates the plan prints. What is machine-dependent is the
  wall clock the plan quotes for `minimap2`, which was 5.4 s here against the
  3.3 s the Mac measured — the take is still inside its turn either way.

## What is still open

- **Turn four's phrasing.** The plan doc's own Open section weighs "name them"
  against "take me to the most interesting one"; the take module currently asks
  the second, because it puts the LEE island on camera rather than ending on a
  list. Worth deciding from the first take rather than in advance.
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
