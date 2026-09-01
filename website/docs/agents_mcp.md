---
title: Driving JBrowse Desktop over MCP
sidebar_label: MCP server
description:
  Let an MCP client such as Claude Desktop drive a running JBrowse Desktop:
  open sessions, build views, restyle tracks, read feature data, and screenshot
  the result
---

The other pages in this section describe an agent that writes a config and opens
it. This one describes the other direction: JBrowse Desktop runs an
[MCP](https://modelcontextprotocol.io) server, so a client such as Claude
Desktop or Claude Code can drive the app that is already open. The session is
not rebuilt from a file each time. The agent reads and changes the live model.

This exists only in JBrowse Desktop. It is safe because of where it runs, a
user-only local socket in a desktop app, and the same surface behind anything
network-reachable would be a remote code execution hole. See
[Turning it off](#turning-it-off) below.

## Setup

JBrowse Desktop must be running. It serves the socket; the client spawns a thin
stdio process that connects to it. Tool calls made while the app is closed
answer with a message saying to launch it.

Add one of these to your Claude Desktop config, then restart the client.

Packaged app on macOS:

```json
{
  "mcpServers": {
    "jbrowse": {
      "command": "/Applications/JBrowse 2.app/Contents/MacOS/JBrowse 2",
      "args": ["--mcp"]
    }
  }
}
```

Development checkout, after `pnpm build && pnpm build:electron-main`:

```json
{
  "mcpServers": {
    "jbrowse": {
      "command": "node",
      "args": [
        "/path/to/jbrowse-components/products/jbrowse-desktop/build/mcpServer.js"
      ]
    }
  }
}
```

## The four tools

`run_javascript` is the interface. It runs an async function body inside the app
against the live [session model](/docs/models), and whatever you return comes
back serialized. Everything else an agent needs is code.

The other three exist because renderer JavaScript cannot express them:

- `screenshot` captures the window after waiting for tracks to finish drawing.
  Pixels live in the main process. The result carries the settle status
  alongside the image.
- `open` loads a config file, a saved `.jbrowse` session, or a JBrowse Web URL,
  replacing the current session. It is the recovery path when nothing is open or
  the session is broken. Called with no target, it lists recent sessions.
- `docs` serves the bundled reference (`live-model`, `session-spec`,
  `automating`). It is version locked to the running binary and readable while
  the app is closed.

## The `jb` standard library

`run_javascript` gets `session`, `rootModel`, `pluginManager`, and `jb`. State
persists on `globalThis` between calls, so an agent can build up its own helpers
across a conversation.

```js
jb.sessionSummary() // views, tracks, assemblies, visible regions
jb.inspect(path) // walk the live model, including getters a snapshot omits
jb.listTracks(search) // the catalog, connection and hub tracks included
jb.trackModel(trackId) // the shown track's live model
jb.describeSlots(conf) // every settings key a display accepts
jb.loadSessionSpec(spec) // build views declaratively
jb.addTrack({ location }) // local path or URL, format inferred
jb.getFeatures({ trackId }) // the track's data as Feature objects
jb.waitReady(ms) // wait for drawing to settle, and report what did not
jb.require(name) // the module registry plugins link against
```

`jb.mst` and `jb.mobx` are the full mobx-state-tree and mobx APIs, and
`window.require` reaches the DOM and Node.

## A worked session

Orient first. Never assume state carried over from a previous call.

```js
return jb.sessionSummary()
```

Find track ids rather than guessing them. A trackId that does not exist opens
nothing and reports nothing.

```js
return jb.listTracks('clinvar')
```

Build a view declaratively. This is the same spec JSON that `&session=spec-`
URLs take, documented in full at [](/docs/urlparams):

```js
return jb.loadSessionSpec({
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'hg38',
      loc: 'chr17:7,668,421-7,687,490',
      tracks: ['hg38-ncbiRefSeqCurated', 'hg38-clinvarMain'],
    },
  ],
})
```

Gene names work through the text search index, so navigation takes a symbol:

```js
await session.views[0].navToLocString('TP53')
return jb.waitReady(30000)
```

Read the underlying data rather than describing the picture. Features come back
as live objects, so aggregate in code and return only the answer:

```js
const feats = await jb.getFeatures({ trackId: 'hg38-clinvarMain' })
const counts = {}
for (const f of feats) {
  const k = f.get('clinSign') ?? 'unstated'
  counts[k] = (counts[k] ?? 0) + 1
}
return { total: feats.length, counts }
```

## Changing how a track looks

Display settings are config slots, not plain properties, and the vocabulary is
per display type. Ask what a display accepts before writing to it:

```js
const track = jb.trackModel('hg38-clinvarMain')
return jb.describeSlots(track.activeDisplay.configuration)
```

Then write them with the model action, which reports what landed:

```js
return jb.trackModel('hg38-clinvarMain').applyDisplaySettings({
  height: 220,
  displayMode: 'compact',
})
```

The return value is `{ applied, unapplied, failed }`. `failed` means a value was
rejected and is the one worth acting on. `unapplied` also collects keys that are
simply not config slots for that display.

A track too tall for the window is a height strategy rather than a display mode.
Many displays take `heightMode: 'fit'`, which squashes the content into the
height slot, or `heightMode: 'grow'`. `displayMode: 'compact'` only shrinks each
feature and will not tame a deep stack.

## Verifying what you built

A wrong trackId, an empty region, or a dropped settings key all render as a
plausible looking browser with something quietly missing. Two habits catch it.

Read the settle result, not just the image. `jb.waitReady` and `screenshot` both
report `notifications`, the session's own error toasts, and `notReady`, the
tracks whose display settled without drawing anything:

```js
const settle = await jb.waitReady(30000)
return {
  notifications: settle.notifications ?? [],
  notDrawn: (settle.notReady ?? []).map(t => `${t.trackId} (${t.phase})`),
}
```

A display over the fetch size limit reports `phase: 'tooLarge'`. It raises no
error toast and replaces its own contents, so a screenshot of it looks fine.
Lift it with the `forceLoad` slot or by zooming in.

Then screenshot, and actually read the image back.

## Four traps

**Data files may spell reference names differently from the assembly.** A file
using `1` where the assembly says `chr1` answers nothing, silently.
`jb.getFeatures` renames for you. Raw adapter code must call
`jb.renameRegionsIfNeeded` first. See [](/docs/config_guide) for refName
aliasing.

**An unknown settings key is dropped.** Use `jb.describeSlots` rather than
guessing, and read the `applied`/`failed` report.

**`view.showTrack` on an already shown track applies nothing.** Use
`applyDisplaySettings` to change a track that is already open.

**`jb.loadSessionSpec` replaces the session.** The `session` argument your code
was given is a dead node afterwards. The `jb` helpers re-read the live session
for you; use `jb.session` if you need to rebind it yourself.

## Turning it off

`run_javascript` is deliberately arbitrary code execution. The guard is the
transport rather than the payload: the socket lives in a directory the app
refuses unless it is owned by the current user with mode 0700, so only processes
already running as that user can connect, and any such process already holds the
same privileges. The endpoint adds convenience, not escalation.

What that does not cover is prompt injection. A hostile dataset description or
web page can ask an agent to run malicious code, and the server cannot tell good
JavaScript from bad. The mitigations are your MCP client's per call approval
prompts and your own judgment, the same contract as any code executing agent
tool.

Set `JBROWSE_DISABLE_MCP=1` to remove the endpoint entirely. Shared workstations
and kiosk installs should.
