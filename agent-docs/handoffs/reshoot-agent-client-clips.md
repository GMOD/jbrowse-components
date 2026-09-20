---
name: reshoot-agent-client-clips
description: The agents page's clips are being reshot on the Linux TUI harness so every one shows the terminal beside the app — the E. coli synteny take (replacing the fly synteny clip), derivative and geo_ratio remain, none recorded yet; the protein take was dropped. The E. coli take's inputs are staged and its last attempt reached turn four before an app bug, since fixed, stalled it. Blocked only on a quiet desktop, since the tiling keystroke needs focus. Read before filming any agent-client clip, and before reaching for the Claude-app harness, which was tried and judged not showcase material.
---

# Reshoot the agent client clips

`website/docs/agents.md` embeds `agent_geo_ratio_take1` (terminal beside the
app) and two clips from the older `agentDemo.mjs` (the JBrowse window alone):
`agent_synteny_take1` and `agent_derivative_take1`. The goal is three clips
shot with `recordDemoTui.mjs`, so every one shows the real Claude Code TUI
beside JBrowse. **Delete this file when the new clips are embedded.**

The harness and its traps are `scripts/agent-demos/CLAUDE.md`; each take's plan
is `scripts/agent-demos/takes/<take>.md`. The Claude desktop app harness
(`recordDemoApp.mjs`) was tried on 2026-09-08 and judged not showcase material;
[ideas/closed/land-the-agent-client-demo-videos.md](../ideas/closed/land-the-agent-client-demo-videos.md)
says why.

## Running a take

```bash
pnpm --filter @jbrowse/desktop build
YDOTOOL_SOCKET=/run/user/1001/.ydotool_socket \
  node scripts/agent-demos/recordDemoTui.mjs ~/agent-takes/<take> \
  scripts/agent-demos/takes/<take>.mjs
```

- `ydotoold` on this machine is the systemd user service, listening on
  `/run/user/1001/.ydotool_socket`, not the `/tmp` path the harness defaults to.
- Pre-staged inputs are in `~/agent-takes/ecoli_synteny/cwd` (`k12.fa.gz`,
  `sakai.fa.gz`) and `~/agent-takes/derivative/cwd` (the COLO829 SV VCF and the
  three-chromosome GRCh38 FASTA). Aborted attempts are under
  `~/agent-takes/old/`. Clear everything in a take's directory except `cwd/`
  before rerunning.
- **Nobody may touch the keyboard or mouse for the first ~15 seconds.** The
  harness presses Super+Left/Right to tile the two windows, and input from a
  person at the desk sends the keystroke elsewhere. The take then stops with
  "the terminal did not tile — it is still 80 columns wide". Two attempts on
  2026-09-14 died this way while the machine was in use.
- Stop a take with `kill -INT $(pgrep -xf "node scripts/agent-demos/recordDemoTui.mjs")`.
  `-x` matches the whole command line; a bare `pkill -f recordDemoTui.mjs` also
  matches the shell running it and kills that shell first.
- Shoot `takes/smoke.mjs` first when the loop has not run for a while: one turn
  against hosted hg38 proves the harness before a long take.

## Order and what to watch

1. **ecoli_synteny.** Replaces the fly synteny clip, whose recipes quote the
   2.4% divergence of that very pair, so an agent could copy the number rather
   than measure it. Watch for the points below.
2. **derivative.**
3. **geo_ratio.** Reshoot so all three match the Linux harness's look.

Then: new clips into the media store (`pnpm figures:push`, per
`website/CLAUDE.md` § Videos), `externalClips` in `website/scripts/video-specs.ts`
with `width`/`height` from the encode, and in `agents.md` the E. coli clip
(`mcp/agent_ecoli_take1`) with its own caption in place of
`agent_synteny_take1`, and the sentence before the shell clips, which still says
they were "filmed against only the JBrowse window". Update the Open section of
`takes/ecoli_synteny.md`, which says the take has never been shot.

## The E. coli take

The take's plan holds the pair, the staging commands and every verified number.
What the plan does not hold:

- **Check UCSC before shooting.** The take's own data is local, but its SYSTEM
  tells the agent to merge the two hosted genark configs, and turn four reads
  gene names off the Sakai track, which UCSC serves. `curl -o /dev/null -w
  '%{time_total}'` against
  `hgdownload.soe.ucsc.edu/hubs/GCF/000/008/865/GCF_000008865.2/GCF_000008865.2.chromAlias.txt`
  answered in 0.58 s on 2026-09-16; on 2026-09-09 it took ~6 s and the agent
  spent turn one diagnosing the network.
- **The last attempt**, 2026-09-10, is `~/jbrowse-ecoli-take/demo.mp4`. The
  agent aligned, merged, opened synteny and the dotplot, and answered turn three
  from the PAF (83 blocks, 912,869 bp of Sakai unaligned). Turn four went to the
  Stx1 prophage (`NC_002695v2:2,923,000-2,927,000`), not LEE, then stalled: the
  agent had called `compactAllViews()`, and a collapsed row's gene track held
  the ready marker at `loading`. `rendersDisplays` on `BaseViewModel` fixed the
  stall; the recorder's 600-second cap, which also cut the take, now derives
  from the turn cap.
- **Turn four still needs `expandAllViews()`** to show a gene track after a
  compact, and even expanded the Sakai row's track sits below the fold of the
  synteny panel, so a screenshot needs the panel taller.
- **Turn four's phrasing is open.** The module asks "take me to the most
  interesting one" to put LEE on camera rather than end on a list, but the last
  attempt picked Stx1, so that phrasing does not reliably reach LEE.
- That attempt ran on Sonnet and reached 156k of 200k context by turn four. The
  harness now launches Opus.

## Already landed from the aborted takes

- Prompts type one character at a time, and the TUI runs without `--verbose`.
- The harness films Opus, not Sonnet: Sonnet wrote `x ? x() : null` probes on
  camera.
- The ESMFold protein take is gone: protein3d's AlphaFoldDB examples already
  show a structure beside a gene.
- A bare absolute path in a `uri` opens as a local file on Desktop; a session
  built over MCP 404'd on `uri: '/home/…/x.fa.gz'`. The harness also puts the
  repo `jbrowse` CLI on PATH, as the synteny prompts promise.
- minimap2 presets: sim/mau measure 2.4% divergence, so `asm20`, not the `asm5`
  the agent chose or the `asm10` the fly tutorial used. A recipe now measures
  before choosing, and the tutorial's numbers were remeasured.
- `jb.sessionSummary()`, and so `loadSessionSpec`, threw "reading 'length'"
  whenever a dotplot was open.
- The MCP instructions put `jb.loadSessionSpec` first, and a recipe builds two
  genomes, their alignment, a synteny view and a dotplot in one spec. That
  recipe reaches the network, so `mcpConformance.ts` skips it; it was verified
  by hand against the built app.
- A typed chunk starting with `-` no longer reaches tmux as a flag, and a turn
  cap firing mid-turn no longer types over a working session (the cap is 40
  minutes).
