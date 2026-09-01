---
name: land-the-agent-client-demo-videos
description: take 5 of the Claude Code demo is shot and encoded but unapproved, and the side-panel take is blocked on knowing when a turn ended
metadata:
  area: agents, website, videos
  category: visual-call
  order: 1
  first_move: "watch take 5 and say yes or no — everything downstream is blocked on that one verdict, and the take is already on disk"
---

# Land the agent client demo videos

MCP ships in v5.0.0 with nothing showing it running. Three clients were wanted:
Claude Code, Claude Desktop, the Chrome extension.

## Claude Code over desktop MCP — shot, encoded, awaiting a verdict

A 60s mp4 with poster, filmed by a real `claude -p` session driving JBrowse
Desktop over its MCP socket, captioned from what Claude actually said and
actually sent.

It is a good take on the merits, which is why it is worth watching rather than
re-shooting: the agent verified hg38 from the bigWig header rather than
trusting the GEO series metadata, checked its log2 normalization against
control loci (gene deserts came out at exactly 0.00, which is what says the
offset is locus-specific), and its closing audit caught a stale precomputed
window it had introduced two turns earlier and rebuilt the track on camera.

**Approve it in the Videos tab, then:** an `externalClips` entry in
`website/scripts/video-specs.ts` — the generator cannot film this one, since
there is no url to load, no steps to run and no live session to hand a reader —
then the `<Video>` embed, `pnpm figures:push`, commit `media.lock`, then
`pnpm autogen`. That order is in `website/CLAUDE.md` and no check enforces it.

## The Chrome side panel take — blocked on one thing

The harness types into the real side panel and the panel really drives
jbrowse.org. What does not work is knowing when a turn ended.

Watching the conversation column for pixel quiet **fired 16 seconds into turn 1
on both runs**, which is wrong for a turn that opens a view and loads tracks —
so the harness typed turn 2 while Claude was still working on turn 1. The panel
streams in bursts with long gaps, so "quiet" and "done" are not the same thing,
and a longer quiet threshold only trades one wrong answer for a slower one.
**Solve that before re-shooting.** The panel is a `chrome-extension://` page, so
the extension's own `javascript_tool` cannot read it — host permissions are
http/https.

## Claude Desktop — not started

Needs the same keyboard path, which now works.

## Before filming anything again

The macOS automation findings, the artifact locations and what is already
established about the extension are in
[handoffs/agent-clients-and-demos](../handoffs/agent-clients-and-demos.md).
**The harness scripts live only in an ephemeral scratchpad** — read that first
or rediscover a day of dead ends.
