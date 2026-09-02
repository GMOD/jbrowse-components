---
title: Using JBrowse with AI agents
sidebar_label: Overview
description:
  Set up Claude Desktop, Claude Code or the Claude in Chrome extension to drive
  JBrowse, what to ask it, and what to watch for
---

JBrowse Desktop runs an MCP server, and JBrowse Web publishes a helper library
on `window`, so an AI agent can open genomes, add tracks, read the data and
screenshot the result in the app you already have open.

## What it looks like

Three real Claude Code sessions driving JBrowse Desktop with a shell beside it.
The captions are what the agent said and sent; only the questions were written
in advance.

<Video src="/media/mcp/agent_protein_take1.mp4" caption="Asked to open hg38 at HBB, fold the transcript's own translation with ESMFold, fold the sickle variant beside it, and say whether the fold changed. The agent translated the CDS in a shell, folded both, served the files and connected each structure to the gene." />

<Video src="/media/mcp/agent_synteny_take1.mp4" caption="Asked to open two fly genomes side by side with no published alignment between them, add a whole-genome dotplot, and find the largest inversion. The agent ran minimap2 in the background, merged the two hosted configs, and read the answer off the alignment before navigating to it." />

<Video src="/media/mcp/agent_derivative_take1.mp4" caption="Asked to find a somatic rearrangement chaining three chromosomes, rebuild the allele from the tumor reads, show the reads on it next to the reference, and prove no read clips at a junction. The agent built the contig from the reads, loaded it as an assembly, and audited every CIGAR at every junction." />

## Claude Desktop or Claude Code, with JBrowse Desktop

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

3. Restart the client and ask it to open JBrowse. It lists your recent sessions,
   which proves the whole path.

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

- [](/docs/agents_live_model) is the reference the agent reads.
- [](/docs/agents_recipes) is a verified snippet per ask.
- [](/docs/agents_hosted_data) is every UCSC and GenArk genome as a ready
  config.
- Inside Desktop the same three are `docs` topics, so an agent never needs this
  site.
- [](/docs/agents_capture) is screenshots from a script, outside any agent.
