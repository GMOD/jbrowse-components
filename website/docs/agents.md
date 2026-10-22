---
title: Using JBrowse with AI agents
sidebar_label: Connecting an agent
description:
  The two ways an AI agent works with JBrowse, and how to connect Claude
  Desktop, Claude Code or the Claude in Chrome extension to the running app
---

An AI agent works with JBrowse in two ways:

- **Driving the open app.** JBrowse Desktop runs an MCP server, and JBrowse Web
  publishes a helper library on `window`, so an agent can open genomes, add
  tracks, read the data and screenshot the result in the app you already have
  open. The sections below set that up.
- **Writing the config from a shell.** An agent such as Claude Code writes a
  `config.json` or session spec, validates it, and renders it with
  `@jbrowse/img` or `@jbrowse/capture`, with no app running.
  [](/docs/agents_authoring) covers that loop.

## What it looks like

The video below shows a real Claude Code session driving JBrowse Desktop over
the four MCP tools and nothing else — no shell, no files. The terminal is in
frame, so what was asked and what the agent ran are both on screen. The bigWigs
stream from GEO by range request, and the ratio is computed against the live
session the way deepTools `bigwigCompare` would: depth-normalized, finely
binned, smoothed over a window several bins wide.

<Video src="/media/mcp/agent_geo_ratio_take2.mp4" caption="An agent opening hg38 at CDKN1A, adding four GEO ATAC-seq bigWigs, deriving a log2 ratio track and checking it against control loci." />

Two more with a shell beside the app; only the questions were written in
advance.

<Video src="/media/mcp/agent_ecoli_take2.mp4" caption="An agent aligning E. coli K-12 against O157:H7 Sakai with minimap2, opening both genomes with the alignment and a dotplot, and zooming to a Sakai-only island at the Shiga toxin 2 genes." />

<Video src="/media/mcp/agent_derivative_take2.mp4" caption="An agent rebuilding a three-chromosome derivative allele from tumor reads, then grouping the reads on it and on the reference by the allele each one runs through." />

## Claude Desktop or Claude Code, with JBrowse Desktop

The MCP server ships in **JBrowse Desktop 5.0.0 and later**. On an earlier build
the `--mcp` argument below is unhandled, so the client launches the app's window
and waits forever on a server that never speaks — the app is on screen and the
agent cannot reach it. **Help → Connect an AI agent...** exists only in a build
that serves the bridge, which is the quickest way to tell.

1. Install JBrowse Desktop, launch it, and leave it running.
2. Point the client at the app binary with `--mcp`. Claude Desktop, under
   Settings, Developer, Edit Config:

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

   Any other MCP client takes the same command and argument. On Windows the
   binary is `%LOCALAPPDATA%\Programs\JBrowse 2\jbrowse-desktop.exe` and on
   Linux it is the AppImage you downloaded.

3. Restart the client and ask it to open JBrowse. If it lists your recent
   sessions, the client, the app and the bridge are all connected.

Then ask in plain words:

- open hg38 at BRCA1 with ClinVar
- how many pathogenic variants are on screen
- add this bigWig from GEO
- make the gene track compact
- save a figure of each of these loci

The agent gets four tools:

- `run_javascript` runs code inside the app against the live session
- `screenshot` captures the window
- `open` loads a config, a saved session or a hosted genome
- `docs` reads the reference bundled into the app

## Claude in Chrome, with JBrowse Web

- Open any JBrowse Web instance in Chrome, for example a
  [hosted genome](/docs/agents_hosted_data), and open the Claude side panel.
- There is nothing to install. The page publishes `window.jb`, and the
  extension's JavaScript tool runs in the page.
- A browser cannot read local files or run tools, so a file the agent adds has
  to be a URL its host lets a web page fetch.

## What to watch for

- **It runs code.** Every call your client asks you to approve is JavaScript
  executed in the app. Read what it is about to do, and do not point it at data
  you do not trust: a hostile track description can ask an agent to run
  something. `JBROWSE_DISABLE_MCP=1` removes the Desktop endpoint entirely.
- **Ask it to verify, and read the screenshot yourself.** A track over its fetch
  size limit, a file whose chromosome names do not match the assembly, or a
  track id that does not exist each draws nothing and looks fine in a picture.
  The agent's settle report names any track that did not draw.
- **A person clicking between calls changes the state.** The agent re-reads the
  session each call; if it seems confused, tell it what you did.
- **Work the app cannot do needs a shell.** An aligner, a fold, a consensus:
  Claude Code has one, and in Claude Desktop the agent can reach the machine's
  tools through JBrowse Desktop's own Node runtime.
- **Claude Code is the better-briefed client.** It shows the agent the server's
  instructions; Claude Desktop currently does not
  ([anthropics/claude-ai-mcp#93](https://github.com/anthropics/claude-ai-mcp/issues/93)),
  so there the agent learns the `jb` helpers from its first tool result and from
  `docs`. If a Desktop session guesses at the model instead, ask it to read
  `docs topic:"live-model"`.

## How it works

However the agent got in, it drives JBrowse by running JavaScript against the
live session with `jb` as its standard library:

```js
jb.sessionSummary() // views, tracks, assemblies, visible regions
jb.listTracks(search) // the catalog, with trackIds
jb.loadSessionSpec(spec) // build views declaratively
jb.getFeatures({ trackId }) // a track's data, as Feature objects
jb.trackModel(trackId).applyDisplaySettings(s) // restyle, and report what landed
jb.waitReady(ms) // wait for drawing, and report what did not draw
```

Each helper covers an answer the raw model gets wrong with no error: a refName
the file spells differently, a settings key the display drops, a track that
settled without drawing. Everything else is the model itself.

- [](/docs/agents_live_model) is the reference the agent reads.
- [](/docs/agents_recipes) is a verified snippet per ask.
- [](/docs/agents_hosted_data) is every UCSC and GenArk genome as a ready
  config.
- Inside Desktop the same three are `docs` topics, so an agent never needs this
  site.
- [](/docs/agents_authoring) and [](/docs/agents_capture) are the shell route:
  write a config, then render it.
