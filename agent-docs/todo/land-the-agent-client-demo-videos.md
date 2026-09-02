---
name: land-the-agent-client-demo-videos
description: three shell takes of Claude Code driving Desktop are published and embedded on the agents overview awaiting a verdict; the side-panel take is blocked on knowing when a turn ended
metadata:
  area: agents, website, videos
  category: visual-call
  order: 1
  first_move: "watch the three clips on /docs/agents and say yes, reshoot, or cut; each take doc ends with what to change before a reshoot"
---

# Land the agent client demo videos

MCP ships in v5.0.0 with nothing showing it running. Three clients were wanted:
Claude Code, Claude Desktop, the Chrome extension.

## Claude Code over desktop MCP — three takes published, awaiting a verdict

Take 5 (the GEO ATAC take) was encoded but its mp4 was never pushed to the
store and the scratchpad that held it is gone; only
`scripts/agent-demos/take5-transcript.txt` remains. It was superseded on
2026-09-01 by three shell-capable takes, each a real `claude -p` session with
Bash beside the MCP tools: fold the transcript (HBB, ESMFold), two assemblies
with no alignment (D. simulans against D. mauritiana), and the derivative allele
(COLO829). Plans, verified numbers and rehearsal notes are
`scripts/agent-demos/takes/*.md`; transcripts are beside them.

The clips are in the media store (`website/media.lock`, `mcp/agent_*_take1`),
registered in `externalClips`, and embedded at the top of
`website/docs/agents.md`. What is left is the visual verdict, and three
app-side gaps the protein take exposed, recorded at the bottom of
`takes/protein.md`: ProteinView absent from the bundled `docs`, the live
`applyLayoutSpec` taking `viewIds` where the spec `layout` takes indexes, and
the connected genome view not being a layout index.

## The Chrome side panel take — ready to re-shoot

The point of this one is to show a reader **how to use the Claude extension
themselves**, not to demonstrate automation, so the questions are written the
way a viewer would type them and the first says out loud that `window.jb`
exists — an agent cannot guess that, and it is the tip the whole clip exists to
pass on.

The harness types into the real side panel and the panel really drives
jbrowse.org. The turn-completion problem that stopped the first two takes is
**no longer worth solving precisely**: pixel quiet fired 16s into turn 1 and
typed the next question over a turn still running, but the fix is simply to
wait far longer, because the encoder collapses any static stretch to 0.6s. A
three-minute overshoot costs half a second of finished clip. The threshold is
now 90s, and being clever here is what broke it.

Still true: the panel is a `chrome-extension://` page, so the extension's own
`javascript_tool` cannot read it — host permissions are http/https. Any
cleverer detection has to come from pixels.

## Claude Desktop — not started

Needs the same keyboard path, which now works.

## Before filming anything again

The macOS automation findings, the artifact locations and what is already
established about the extension are in
[handoffs/agent-clients-and-demos](../handoffs/agent-clients-and-demos.md).
**The harness scripts live only in an ephemeral scratchpad** — read that first
or rediscover a day of dead ends.
