---
title: Driving JBrowse Web from a browser agent
sidebar_label: Browser agents
description:
  JBrowse Web publishes its live session and a helper library on window, so an
  agent running in the browser can build views, restyle tracks and read feature
  data out of the page it is looking at
---

JBrowse Web publishes three things on `window`, unconditionally and in
production: `window.JBrowseSession` is the live session model,
`window.JBrowseRootModel` the root model above it, and `window.jb` the helper
library.

An agent that can run JavaScript in the page, such as a browser extension,
already has everything it needs. Nothing has to be installed and no server is
involved, because the page it is reading is the app.

This is the same `jb` library JBrowse Desktop serves over
[MCP](/docs/agents_mcp), reached from inside the page instead of over a socket.

## What is the same

The library, and the way a session goes. Orient first, because a person can
click between calls. Find track ids in the catalog rather than guessing them,
build views from the same spec JSON that `&session=spec-` URLs take
([](/docs/urlparams)), read the data as live Feature objects and aggregate in
code, restyle a shown track in place and read back what landed, then wait for
drawing before looking:

```js
jb.sessionSummary()
jb.listTracks('clinvar')
jb.loadSessionSpec({
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'hg38',
      loc: 'chr17:7,668,421-7,687,490',
      tracks: ['hg38-ncbiRefSeqCurated', 'hg38-clinvarMain'],
    },
  ],
})
jb.getFeatures({ trackId: 'hg38-clinvarMain' })
jb.trackModel('hg38-clinvarMain').applyDisplaySettings({ height: 220 })
jb.waitReady(30000)
```

The [four traps](/docs/agents#four-traps) are the same too. The full reference
is [](/docs/agents_live_model) and [](/docs/agents_recipes) is the same library
at work, one ask per section.

## What is different

**There is no Node, so there are no local files.** A browser cannot run
samtools, build an index, or read a path. `jb.addTrack` takes a URL and refuses
a local path rather than adding a track that cannot read. Work that needs a real
file belongs in [JBrowse Desktop](/docs/agents_mcp) or in a shell, and
[](/docs/agents_hosted_data) covers what is already loadable with no setup at
all.

**The data host has to allow the request.** A tab is subject to CORS where an
Electron app is not, so a file that loads in Desktop may be unreachable from a
page. This is a property of the host serving the data, not of JBrowse.

**A read runs on the thread that draws.** `jb.getFeatures` uses the main thread
adapter deliberately, because the alternative serializes every feature across
the worker boundary before any limit can apply. The page therefore stops
repainting while a large read runs. Aggregate in code and return the answer
rather than the features.

**A read has a size gate, like a display does.** A display refuses to fetch over
its own limit and paints the reason. `jb.getFeatures` asks the same index-only
question first and throws rather than returning a short answer that looks like a
whole one:

```
region too large for jb.getFeatures: the largest region is ~8200000 bytes
against a limit of 5000000. Narrow the region, or pass an explicit byteLimit
if you mean to pull this much.
```

Narrow the region, or raise the ceiling for a read you mean to be big by passing
`byteLimit` alongside `trackId` and `loc`.

**`jb.require` needs waking first.** It serves the pinned ABI module names
external plugins link against, and that registry is loaded lazily because
installing it eagerly would put most of the UI toolkit into every page load.
Call `await jb.ensureRequire()` once before the first `jb.require(...)`.

A session that already loaded a runtime plugin has the registry installed
already, so this costs nothing there.

**`jb.loadSessionSpec` replaces the session.** In Desktop that is the same as
opening a file. In a browser it also rewrites the URL and stores a new session,
and the session it replaced is not recoverable from the page. Prefer adding to
the open session where that will do.

## From the Claude in Chrome extension

The extension's JavaScript tool evaluates in the page's own world, so
`window.jb` is simply there. A session that opened hg38 at a gene, added a
four-sample GEO bigWig set as one stacked track, derived a ratio track from it
and audited a zoom used nothing but `jb`, the live session and the page's own
`fetch`. What the extension changes is the calling convention:

- **The value is the last expression.** The examples on the MCP page are
  function bodies. In the extension, end the snippet with the value, or wrap the
  body in `(async () => { ... })()`.
- **One evaluation has a fixed time budget**, about 45 seconds, and the code
  keeps running when it expires. `jb.loadSessionSpec` settles the new session
  before it answers, which on a cold hosted config can outlive the budget. Call
  it on its own, and read `jb.sessionSummary()` on the next call.
- **Results are sanitized on the way back.** Nested objects are cut off past a
  few levels, long strings are clipped, and a string that looks like base64 is
  replaced. Return flat, pre-sliced values, or a `JSON.stringify` of what you
  need.
- **Its screenshot knows nothing about rendering.** Call `jb.waitReady()` first,
  then screenshot, and read `notReady` from the settle result for the tracks a
  picture cannot show as missing.
- **Wait for the page.** The app assigns `window.jb` after its first render, so
  poll for it after navigating.

Anything `jb.addTrack` cannot express, such as several files under one
`MultiWiggleAdapter`, is a hand-written config through
`session.addSessionTrackConf`, the same as in Desktop.

## Is this safe

`window.jb` grants no privilege the page did not already have. It runs at the
page's own origin with the user's own session, and every byte of it is in the
bundle regardless. Anything it does, script on that origin could already do
through `window.JBrowseSession`.

What it does change is how easy the app is to drive on purpose, and that cuts
both ways. A hostile track description, or a hostile page in another tab, can
try to instruct an agent that is reading it, and a convenient library makes an
injected instruction more likely to succeed. That risk arrives with the agent
rather than with this library, and the mitigation is the same as for any code
executing agent tool: your client's approval prompts, and not pointing an agent
with write access at data you do not trust.
