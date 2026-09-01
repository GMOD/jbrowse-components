---
title: Driving JBrowse Desktop over MCP
sidebar_label: MCP server
description:
  Let an MCP client such as Claude Desktop drive a running JBrowse Desktop, to
  open sessions, build views, restyle tracks, read feature data, and screenshot
  the result
---

JBrowse Desktop runs an [MCP](https://modelcontextprotocol.io) server, so a
client such as Claude Desktop or Claude Code can drive the app you already have
open. The agent reads and changes the live session rather than rebuilding one
from a file each time.

Desktop only. It is safe because of where it runs, a local socket only your own
account can reach, and the same surface behind anything network reachable would
be a remote code execution hole. See [Turning it off](#turning-it-off).

## Connect a client

Leave JBrowse Desktop running, and point the client at the app binary with
`--mcp`, which opens no window of its own.

Claude Desktop, under Settings, Developer, Edit Config:

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

Claude Code:

```bash
claude mcp add jbrowse -s user -- "/Applications/JBrowse 2.app/Contents/MacOS/JBrowse 2" --mcp
```

Any other MCP client takes the same command and argument. On Windows the binary
is `%LOCALAPPDATA%\Programs\JBrowse 2\jbrowse-desktop.exe` and on Linux it is
the AppImage you downloaded. From a source checkout, run
`node <checkout>/products/jbrowse-desktop/build/mcpServer.js` instead.

Restart the client, then ask it to open JBrowse with no target. It lists your
recent sessions, which is the shortest round trip that proves the whole path.

## What the agent gets

`run_javascript` is the interface. It runs an async function body inside the app
against the live [session model](/docs/models), with `jb` as a standard library:

```js
jb.sessionSummary() // views, tracks, assemblies, visible regions
jb.listTracks(search) // the catalog, with trackIds
jb.trackModel(trackId) // a shown track's live model
jb.getFeatures({ trackId }) // its data, as Feature objects
jb.loadSessionSpec(spec) // build views declaratively
jb.describeSlots(conf) // every setting a display accepts
jb.waitReady(ms) // wait for drawing, and report what did not draw
```

Three more tools exist because renderer JavaScript cannot express them.
`screenshot` captures the window, whose pixels live in the main process. `open`
loads a config, a saved session, a [hosted config](/docs/agents_hosted_data) URL
or a JBrowse Web link, and is the recovery path when nothing is open or the
session is broken. `docs` serves the bundled reference, which is readable while
the app is closed.

## A session

Orient first, and never assume state carried over from a previous call:

```js
return jb.sessionSummary()
```

Build a view from the same spec JSON that `&session=spec-` URLs take, documented
at [](/docs/urlparams). Find track ids with `jb.listTracks` rather than guessing
them, since one that does not exist opens nothing and reports nothing:

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

Read the underlying data rather than describing the picture. Features come back
as live objects, so aggregate in code and return only the answer:

```js
const feats = await jb.getFeatures({ trackId: 'hg38-clinvarMain' })
return Object.groupBy(feats, f => f.get('clinSign') ?? 'unstated')
```

Restyle in place with the track's own action, which reports what landed as
`{ applied, unapplied, failed }`:

```js
return jb.trackModel('hg38-clinvarMain').applyDisplaySettings({
  height: 220,
  displayMode: 'compact',
})
```

A track the agent computed needs no file behind it: a `FromConfigAdapter` in
`session.addSessionTrackConf` carries the features in the track config, so the
derived track saves and reopens with the session. Plan for a few thousand
features and no more, because that array is held in memory and re-serialized by
every autosave. Above that the agent should run the tool that does the job,
write a real indexed file, and load that.

## Four traps

Each of these renders as a plausible looking browser with something quietly
missing.

**Data files may spell reference names differently from the assembly.** A file
using `1` where the assembly says `chr1` answers nothing, silently.
`jb.getFeatures` renames for you. Raw adapter code must call
`jb.renameRegionsIfNeeded` first. See [](/docs/config_guide) for refName
aliasing.

**An unknown settings key is dropped.** Use `jb.describeSlots` to see what a
display accepts, and read the `failed` list that comes back.

**A track over the fetch size limit raises no error.** It replaces its own
contents, so the screenshot looks fine. `jb.waitReady` and `screenshot` both
report it under `notReady` with `phase: 'tooLarge'`, which is why the settle
result is worth reading alongside the image.

**`jb.loadSessionSpec` replaces the session.** The `session` argument the code
was given is a dead node afterwards. The `jb` helpers re-read the live session
for you, and `jb.session` rebinds it.

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
