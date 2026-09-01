---
name: prove-window-jb-against-a-real-browser-agent
description: window.jb shipped on the strength of a probe against a build that did not contain it
metadata:
  area: agents, jbrowse-web
  category: ready
  order: 6
  first_move: "serve a local jbrowse-web build and point `claude -p --chrome` at it — the extension half is already established, so this is one run, not a project"
---

# Prove `window.jb` against a real browser agent

`packages/app-core/src/JbApi/` and `window.jb` landed on the argument that a
browser agent is not short of power but short of affordances. The evidence for
the first half is real: the Claude Chrome extension read `window.JBrowseSession`
on jbrowse.org and got the live session back, with both assemblies on it.

**The evidence for the second half does not exist.** That probe ran against the
DEPLOYED site, which has no `jb` in it. Everything about `jb` in a browser is
proven only under jsdom and under desktop's MCP conformance suite, which is
Electron. So the release would ship an agent surface nobody has driven from the
client it was built for.

## What is owed

- Serve a local jbrowse-web build, and run
  `claude -p --chrome --allowedTools "mcp__claude-in-chrome,ToolSearch"` against
  it. Name a `deviceId`: two Chrome installs register the extension here and the
  run otherwise stops to ask which.
- Run the four turns the desktop demo runs — open hg38 at CDKN1A with genes and
  conservation, add the GEO ATAC-seq as one stacked track, derive a log2 track,
  then zoom and audit. Record where the agent still has to improvise.
- `pnpm test-ci-no-react-compiler`, which has not been run on this work and is
  the only run covering what `build:esm` publishes.

## What the answer decides

If `jb` is what closes the gap, the web surface is worth documenting harder and
`agents_web.md` should grow the worked route. **If it is not, this surface
should shrink rather than grow** — the same bar that removed `defineDisplay`
applies, and a helper library justified only by external agents is not one this
tree keeps.

Do not re-litigate whether a protocol is needed instead. The extension already
runs arbitrary JS in the page and reaches the MST session; WebMCP would add
discoverability, not capability, and that is a separate question from whether
the helpers earn their place.
