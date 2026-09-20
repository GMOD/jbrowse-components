---
name: land-the-agent-client-demo-videos
description: the Claude Code shell takes on /docs/agents are being reshot on the TUI harness (handoffs/reshoot-agent-client-clips.md), so v5.0.0 ships with MCP shown running; what is parked here is the Chrome side-panel reshoot with its 90s turn threshold and the Claude Desktop take, judged not showcase material — the harness and its operating notes are scripts/agent-demos/
---

# Land the agent client demo videos

Moved out of [TODO.md](../../TODO.md) on 2026-09-02. The clips are live on the
agents overview, which is the part the release turned on; the verdict on them,
the side-panel reshoot and the Desktop take are polish the release does not
wait for.

MCP ships in v5.0.0 and three clients were wanted showing it running:
Claude Code, Claude Desktop, the Chrome extension.

## Claude Code over desktop MCP — being reshot

Three takes are published as `mcp/agent_*_take1` and embedded at the top of
`website/docs/agents.md`: GEO ATAC, two fly assemblies with no alignment, and
the COLO829 derivative allele. The verdict on them was to reshoot all three on
the TUI harness so each shows the terminal beside the app, with the E. coli
take replacing the fly one;
[handoffs/reshoot-agent-client-clips.md](../../handoffs/reshoot-agent-client-clips.md)
holds that thread. The ESMFold take was dropped on 2026-09-14: protein3d's
AlphaFoldDB examples already show a structure beside a gene.

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

## The Claude desktop app — attempted, and not showcase material

Tried on 2026-09-08 with a harness written for it (`recordDemoApp.mjs` +
`appClient.mjs`, whose traps are in
[`scripts/agent-demos/CLAUDE.md`](../../../scripts/agent-demos/CLAUDE.md)). It runs
end to end and the smoke take encodes in 75 s; the verdict on the output was
"not working well at all, it is not showcase material", and the reason is
structural rather than a bug list. tmux gives the TUI harness real text state,
while every interaction here is a pixel probe, so a failure is silent by
default: on the first four-turn take the model never switched, the account email
and usage card filmed, and a blind banner click detached the session's folder,
after which the agent aligned two unrelated FASTAs and reported success.

Two things would have to change before it is worth another attempt: the filmed
session needs Bypass permissions (in Auto mode the app blocks any command it
cannot statically analyze, and a blocked turn is indistinguishable from a
finished one by stillness), and the chrome cleanup needs to stop clicking
anywhere it has not first detected something to click. The findings are all
recorded, so a later attempt starts from a working startup rather than from
scratch — but the TUI harness remains the one that produces clips.

## Before filming anything again

The harness, the macOS automation findings and what is established about the
Chrome extension are all in
[`scripts/agent-demos/CLAUDE.md`](../../../scripts/agent-demos/CLAUDE.md). Read it
first or rediscover a day of dead ends.
