---
name: reshoot-agent-client-clips
description: The agents page's clips are being reshot on the Linux TUI harness so every one shows the terminal beside the app. E. coli Take 1 (2026-09-16) is shot and its flaws fixed in the take, so it is ship-or-reshoot; derivative and geo_ratio are not shot. Blocked only on a quiet desktop, since the tiling keystroke needs focus. Read before filming any agent-client clip.
---

# Reshoot the agent client clips

`website/docs/agents.md` embeds `agent_geo_ratio_take1` (terminal beside the
app) and two clips from the older `agentDemo.mjs` (the JBrowse window alone):
`agent_synteny_take1` and `agent_derivative_take1`. The goal is three clips
shot with `recordDemoTui.mjs`, so every one shows the real Claude Code TUI
beside JBrowse. **Delete this file when the new clips are embedded.**

The harness, its traps and how to run a take are `scripts/agent-demos/CLAUDE.md`;
each take's plan is `scripts/agent-demos/takes/<take>.md`. Pre-staged inputs
are in `~/agent-takes/ecoli_synteny/cwd` and `~/agent-takes/derivative/cwd`.

1. **ecoli_synteny.** Take 1 is `~/agent-takes/ecoli_synteny/demo-captioned-fixed.mp4`
   and `takes/ecoli_synteny.md` §"Take 1, 2026-09-16" records its flaws and
   fixes: ship it or reshoot. It replaces the fly synteny clip, whose recipes
   quote the 2.4% divergence of that very pair, so an agent could copy the
   number rather than measure it.
2. **derivative.**
3. **geo_ratio.** Reshoot so all three match the Linux harness's look.

Then: new clips into the media store (`pnpm figures:push`, per
`website/CLAUDE.md` § Videos), `externalClips` in `website/scripts/video-specs.ts`
with `width`/`height` from the encode, and in `agents.md` the E. coli clip
(`mcp/agent_ecoli_take1`) with its own caption in place of
`agent_synteny_take1`, and the sentence before the shell clips, which still says
they were "filmed against only the JBrowse window".
