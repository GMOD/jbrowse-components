---
name: reshoot-agent-client-clips
description: The agents page's clips are being reshot on the Linux TUI harness so every one shows the terminal beside the app. The derivative clip is done (take 2); E. coli and geo_ratio remain, and E. coli Take 1's video is gone, so it is a reshoot with the fixes its notes record. The harness films in a headless GNOME Shell, so nothing blocks a take but running it. Read before filming any agent-client clip.
---

# Reshoot the agent client clips

`website/docs/agents.md` embeds `agent_geo_ratio_take1` (macOS harness,
terminal beside the app), `agent_derivative_take2` (Linux TUI harness) and
`agent_synteny_take1` (the older `agentDemo.mjs`, the JBrowse window alone).
The goal is three clips shot with `recordDemoTui.mjs`, so every one shows the real Claude Code TUI
beside JBrowse. **Delete this file when the new clips are embedded.**

The harness films in its own headless GNOME Shell; `takes/smoke.mjs` ran clean
on 2026-10-19 under `CLAUDE_CONFIG_DIR=$HOME/.claude3`. A take's `clip.mp4`
and `clip.jpg` are what goes to the media store.

The harness, its traps and how to run a take are `scripts/agent-demos/README.md`;
each take's plan, and its staging under "Before filming", is
`scripts/agent-demos/takes/<take>.md`.

1. **ecoli_synteny.** Take 1 (2026-09-16) is no longer on disk, here or on
   ada, so reshoot. `takes/ecoli_synteny.md` §"Take 1, 2026-09-16" records
   its four flaws, each fixed in the SYSTEM or jbApi since, and §"Open" the
   checks to run before shooting. It replaces the fly synteny clip, whose
   recipes quote the 2.4% divergence of that very pair, so an agent could copy
   the number rather than measure it.
2. **derivative.** Done, take 2 (2026-10-19).
3. **geo_ratio.** Reshoot so all three match the Linux harness's look.

Then: new clips into the media store (`pnpm figures:push`, per
`website/CLAUDE.md` § Videos), `externalClips` in `website/scripts/video-specs.ts`
with `width`/`height` from the encode, and in `agents.md` the E. coli clip
(`mcp/agent_ecoli_take1`) with its own caption in place of
`agent_synteny_take1`, and the sentence before the shell clips, which still says
the synteny clip shows the JBrowse window alone.
