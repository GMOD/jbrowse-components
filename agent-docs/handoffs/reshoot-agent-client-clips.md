---
name: reshoot-agent-client-clips
description: The agents page's clips are being reshot on the Linux TUI harness so every one shows the terminal beside the app — synteny, derivative and geo_ratio remain, none recorded yet; the protein take was dropped. Six app and guidance gaps the aborted takes exposed are fixed and landed. Blocked only on a quiet desktop, since the tiling keystroke needs focus. Read before filming any of them.
---

# Reshoot the agent client clips

`website/docs/agents.md` embeds `agent_geo_ratio_take1` (terminal beside the
app) and two clips from the older `agentDemo.mjs` (the JBrowse window alone):
`agent_synteny_take1` and `agent_derivative_take1`. The goal is all three
reshot with `recordDemoTui.mjs`, so every clip shows the real Claude Code TUI
beside JBrowse. **Delete this file when the new clips are embedded.**

The harness and its traps are `scripts/agent-demos/CLAUDE.md`; each take's plan
is `scripts/agent-demos/takes/<take>.md`.

## Running a take

```bash
pnpm --filter @jbrowse/desktop build
YDOTOOL_SOCKET=/run/user/1001/.ydotool_socket \
  node scripts/agent-demos/recordDemoTui.mjs ~/agent-takes/<take> \
  scripts/agent-demos/takes/<take>.mjs
```

- `ydotoold` on this machine is the systemd user service, listening on
  `/run/user/1001/.ydotool_socket`, not the `/tmp` path the harness defaults to.
- Pre-staged inputs are already in `~/agent-takes/synteny/cwd` (`sim.fa.gz`,
  `mau.fa.gz`) and `~/agent-takes/derivative/cwd` (the COLO829 SV VCF and the
  three-chromosome GRCh38 FASTA). Aborted attempts are under
  `~/agent-takes/old/`. Clear everything in a take's directory except `cwd/`
  before rerunning.
- **Nobody may touch the keyboard or mouse for the first ~15 seconds.** The
  harness presses Super+Left/Right to tile the two windows, and input from a
  person at the desk sends the keystroke elsewhere. The take then stops with
  "the terminal did not tile — it is still 80 columns wide". Two attempts on
  2026-09-14 died this way while the machine was in use.
- Stop a take with `kill -INT $(pgrep -f "node scripts/agent-demos/recordDemo[T]ui")`.
  A bare `pkill -f recordDemoTui.mjs` matches the shell running it and kills
  that shell first.

## Order and what to watch

1. **synteny.** The next take to shoot. Watch for: whether the agent builds the
   comparison with one `jb.loadSessionSpec` spec rather than guarded action
   probes, and whether it measures divergence or copies the 2.4% the recipe
   quotes for this very pair. Both recipes use sim/mau as their example, so a
   copied number is likely. Swapping their example pair is the open question
   for Colin, not yet decided.
2. **derivative.**
3. **geo_ratio.** Reshoot so all three match the Linux harness's look.

Then: new clips into the media store (`pnpm figures:push`, per
`website/CLAUDE.md` § Videos), `video-specs.ts` sizes, and the sentence in
`agents.md` before the shell clips, which still says they were "filmed against
only the JBrowse window".

## Already landed from the aborted takes

- Prompts type one character at a time, and the TUI runs without `--verbose`.
- The harness films Opus, not Sonnet: Sonnet wrote `x ? x() : null` probes on
  camera.
- The ESMFold protein take is gone: protein3d's AlphaFoldDB examples already
  show a structure beside a gene.
- A bare absolute path in a `uri` opens as a local file on Desktop; a session
  built over MCP 404'd on `uri: '/home/…/x.fa.gz'`. The harness also puts the
  repo `jbrowse` CLI on PATH, as the synteny prompt promises.
- minimap2 presets: sim/mau measure 2.4% divergence, so `asm20`, not the `asm5`
  the agent chose or the `asm10` the fly tutorial used. A recipe now measures
  before choosing, and the tutorial's numbers were remeasured.
- `jb.sessionSummary()`, and so `loadSessionSpec`, threw "reading 'length'"
  whenever a dotplot was open.
- The MCP instructions put `jb.loadSessionSpec` first, and a recipe builds two
  genomes, their alignment, a synteny view and a dotplot in one spec. That
  recipe reaches the network, so `mcpConformance.ts` skips it; it was verified
  by hand against the built app.

## Unchecked

- `pnpm test-related` after the last two app commits (`3f46c43b70`,
  `6774300bb4`) has not run; only the jb API and Desktop MCP suites did. An
  earlier run showed `workerModules.test.ts` and `fetchAutorun.test.ts` red,
  unrelated to these changes and not confirmed red on main.
