---
title: Using JBrowse with AI agents
sidebar_label: Overview
description:
  How an AI agent drives JBrowse, with three filmed sessions, the setup for
  Claude Desktop, Claude Code and browser agents, the one interface they all
  use, and the traps to know about
---

An agent can drive JBrowse two ways. It can take over the app you already have
open, through JBrowse Desktop's MCP server or through the helper library JBrowse
Web publishes on `window`, and read, build and restyle the live session. Or it
can write a config file, check it, open it and look at the result. This page
covers both, starting with what the first one looks like when it works.

## Three sessions, filmed

Each clip is a real Claude Code session driving JBrowse Desktop over MCP with a
shell beside it. The captions are what the agent said and sent; nothing was
scripted past the questions.

<Video src="/media/mcp/agent_protein_take1.mp4" caption="Asked to open hg38 at HBB, fold the transcript's own translation with ESMFold, fold the sickle variant beside it, and say whether the fold changed. The agent translated the CDS in a shell, folded both, served the files and connected each structure to the gene." />

<Video src="/media/mcp/agent_synteny_take1.mp4" caption="Asked to open two fly genomes side by side with no published alignment between them, add a whole-genome dotplot, and find the largest inversion. The agent ran minimap2 in the background, merged the two hosted configs, and read the answer off the alignment before navigating to it." />

<Video src="/media/mcp/agent_derivative_take1.mp4" caption="Asked to find a somatic rearrangement chaining three chromosomes, rebuild the allele from the tumor reads, show the reads on it next to the reference, and prove no read clips at a junction. The agent built the contig from the reads, loaded it as an assembly, and audited every CIGAR at every junction." />

The questions were typed the way a person would type them. Everything else, from
which tool to run to which track to show, was the agent's. The transcripts, the
harness that filmed them and the plan behind each take are in
`scripts/agent-demos/` in the repository.

## Connect an agent

### JBrowse Desktop, over MCP

Leave JBrowse Desktop running and point the client at the app binary with
`--mcp`, which opens no window of its own. Claude Desktop, under Settings,
Developer, Edit Config:

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
the AppImage you downloaded. Restart the client, then ask it to open JBrowse
with no target: it lists your recent sessions, which proves the whole path.

Desktop only, and safe because of where it runs: the socket is one only your own
account can reach. `JBROWSE_DISABLE_MCP=1` removes it. The safety argument and
the four tools in full are on [](/docs/agents_mcp).

### JBrowse Web, from inside the browser

JBrowse Web publishes `window.jb`, the same helper library, plus
`window.JBrowseSession` and `window.JBrowseRootModel`, unconditionally and in
production. An agent that can run JavaScript in the page, such as the Claude in
Chrome extension, already has everything it needs: nothing to install, no
server. What differs in a browser (no local files, CORS, the extension's result
sanitizing) is on [](/docs/agents_web).

## One interface

However the agent got in, it drives JBrowse by running JavaScript against the
live session with `jb` as its standard library:

```js
jb.sessionSummary() // views, tracks, assemblies, visible regions
jb.listTracks(search) // the catalog, with trackIds
jb.loadSessionSpec(spec) // build views declaratively
jb.trackModel(trackId) // a shown track's live model
jb.getFeatures({ trackId }) // its data, as Feature objects
jb.describeSlots(conf) // every setting a display accepts
jb.waitReady(ms) // wait for drawing, and report what did not draw
jb.inspect('views.0') // a model's getters and actions, by dot path
```

In Desktop that code is the body of the `run_javascript` MCP tool and what it
`return`s comes back. In the browser it is evaluated in the page and the value
is the last expression. A session goes like this: orient, and never assume state
carried over from an earlier call, because a person can click between them;
build from the same spec JSON that `&session=spec-` URLs take
([](/docs/urlparams)), with track ids from the catalog, since one that does not
exist opens nothing and reports nothing; read the data rather than describing
the picture, aggregating in code because features are live objects; restyle in
place and read back what landed; then wait for drawing and look.

```js
// orient
jb.sessionSummary()

// build
await jb.loadSessionSpec({
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'hg38',
      loc: 'chr17:7,668,421-7,687,490',
      tracks: ['hg38-ncbiRefSeqCurated', 'hg38-clinvarMain'],
    },
  ],
})

// read the data, and return the answer rather than the features
const feats = await jb.getFeatures({ trackId: 'hg38-clinvarMain' })
const bySignificance = Object.groupBy(
  feats,
  f => f.get('clinSign') ?? 'unstated',
)

// restyle; the result says what landed as { applied, unapplied, failed }
jb.trackModel('hg38-clinvarMain').applyDisplaySettings({
  height: 220,
  displayMode: 'compact',
})

// verify: a track that settled without drawing is under notReady
const settled = await jb.waitReady(30000)
```

Then a screenshot, and read both the image and the settle result, because a
picture cannot show a track as missing.

### Four traps

Each renders as a plausible looking browser with something quietly missing.

- **Reference names.** A file using `1` where the assembly says `chr1` answers
  nothing, silently. `jb.getFeatures` renames for you; raw adapter code must
  call `jb.renameRegionsIfNeeded` first.
- **Unknown settings keys are dropped.** `jb.describeSlots` says what a display
  accepts, and `applyDisplaySettings` reports the keys it refused.
- **A track over the fetch size limit raises no error.** It replaces its own
  contents, so the screenshot looks fine. `jb.waitReady` reports it under
  `notReady` with `phase: 'tooLarge'`.
- **`jb.loadSessionSpec` replaces the session.** The `session` the code was
  handed is a dead node afterwards; the `jb` helpers re-read the live one, and
  `jb.session` rebinds it.

### With a shell beside it

The three clips above each needed work the app cannot do: an aligner, a fold, a
consensus. The pattern that worked was the same each time. The analysis runs in
the shell and writes files to a working directory; the app shows the files. A
job longer than a call's timeout runs in the background and is polled. In
Desktop a local file loads by path, and a file the app fetches by URL can be
served from the working directory with any static server. Long reads are
aggregated in code and only the answer returned.

## Writing a config instead

An agent with a shell can also do the whole job as files, which is the route for
a view someone else will open later:

```
1. get data       curl / aws s3 cp / samtools view -b <region>
2. make loadable  bgzip + tabix, samtools index, jbrowse add-assembly
3. author         write config.json
4. check          jbrowse validate config.json
5. open           jbrowse-desktop config.json
6. look           screenshot it, and read the picture
```

Steps 1 and 2 belong in a shell: fetching a file, slicing a region out of a BAM,
and building an index are not things a web page can do. Step 3 is a JSON file,
see [](/docs/automating) for the fields, and [](/docs/config_guide) for the
model. Steps 1 to 3 are the ones you can often skip: if the assembly is one of
the [hosted ones](/docs/agents_hosted_data), and the annotation you want is
already published against it, the whole job is a URL.

### Let the CLI write the track

`@jbrowse/cli` knows the slot names:

```bash
jbrowse add-assembly hg38.fa.gz --load copy
jbrowse add-track sample.bam --load copy --name Sample --color darkred
jbrowse add-track https://example.org/genes.gff3.gz --height 200
jbrowse text-index --tracks genes    ## makes a gene name work as a location
```

The track type, the adapter and the index path all come from the file itself: a
`.bw` becomes a `QuantitativeTrack` over a `BigWigAdapter`, a `.vcf.gz` a
`VariantTrack` over a `VcfTabixAdapter`. `--color`, `--height` and
`--displayDefaults` are written into the track's `displayDefaults`; `--load`
says how a local file is placed next to the config and is omitted for a URL;
`--config` takes inline JSON for anything the flags do not cover. Full reference
in [](/docs/cli).

JBrowse runs that same inference when it loads a config, so an agent writing
`config.json` itself can leave the type and the adapter out:

```json addtrack
{
  "trackId": "sample_bam",
  "uri": "https://example.org/sample.bam",
  "assemblyNames": ["hg38"]
}
```

`name` defaults to the file name, and `assemblyNames` can go too when the config
declares one assembly, see
[the shortest track](/docs/config_guides/tracks#the-shortest-track). What the
CLI does not write is what the view opens onto: `defaultSession` and the launch
fields on each view, which are [](/docs/automating), and which
`jbrowse set-default-session` takes once composed.

### Check the result

The one thing to insist on is step 4, because of how JBrowse fails:

> **A config key JBrowse does not recognize is ignored, not reported.** A
> misspelled slot leaves the track loading normally with the setting doing
> nothing.

```bash
jbrowse validate config.json
```

```
error: tracks[0].adapter.bamLocatoin: unknown slot "bamLocatoin" — did you mean "bamLocation"? — JBrowse ignores keys it does not declare, so this setting silently does nothing
error: defaultSession.views[0].tracks[0]: trackId "sample_bem" is not defined in this config — did you mean "sample_bam"?

2 error(s), 0 warning(s) in config.json
```

`--json` gives machine-readable output, and a non-zero exit means errors, so an
agent can loop on it. Errors are things JBrowse accepts and silently gets wrong;
warnings are things it will complain about itself. Full description in
[](/docs/config_guides/intro#checking-a-config-with-jbrowse-validate). One
warning is worth recognizing and leaving alone: a type a **plugin** registers is
not in the manifest, so it is reported as unknown, and an agent that fixes every
line of output rewrites a working track into a core type that cannot show its
data.

### Where the browser comes from

Which application to open the config in is decided by where the data is:

|                       | to run it                          | the data it can read              |
| --------------------- | ---------------------------------- | --------------------------------- |
| `@jbrowse/img`        | nothing                            | local paths (`localPath`) or URLs |
| Desktop               | an install, no server              | local paths                       |
| `@jbrowse/capture`    | a Chromium `npx` fetches           | public URLs the browser may fetch |
| your own web instance | `jbrowse create` + a static server | whatever that server serves       |

The first two need no web server at all. `@jbrowse/img` renders server-side, so
a config whose locations are `localPath` produces a figure from files on disk
with nothing served; Desktop opens a config path directly and keeps local paths
in the session, which is the one to hand a human. `@jbrowse/capture` drives the
public build at `jbrowse.org/code/jb2/latest/`, so every file the view names has
to be a URL that page may fetch. For data that is not public, serve the app and
the data together:

```bash
jbrowse create jbrowse2
jbrowse add-assembly hg38.fa.gz --load copy --out jbrowse2
jbrowse add-track sample.bam --load copy --out jbrowse2
npx serve -S jbrowse2                          ## http://localhost:3000

npx @jbrowse/capture --instance http://localhost:3000 \
  --config http://localhost:3000/config.json --assembly hg38 \
  --loc chr17:43,044,000-43,126,000 --track sample -o out.png
```

**The static server has to honor `Range`.** `npx serve` answers a range request
with `206 Partial Content`; `python3 -m http.server` returns the whole file for
every read. Full setup in [](/docs/quickstart_web).

### Look at the picture

The validator reads the config. It cannot tell you the file was unindexed, the
refNames did not match, or the region has no data, all of which produce a track
that loads and shows nothing. Only the picture says that:

```bash
## a static render, no browser involved
npx @jbrowse/img --hub hg38 --track hg38-ncbiRefSeqCurated --loc BRCA1 --out out.png

## the real app, driven with puppeteer, waited on properly
npx @jbrowse/capture --hub hg38 --track hg38-ncbiRefSeqCurated --loc BRCA1 -o out.png
```

Both are on [](/docs/agents_capture), including how to know the render is done.

## The rest of this section

- [](/docs/agents_mcp): the Desktop MCP server in full, its four tools, and why
  it is safe where it runs and nowhere else.
- [](/docs/agents_web): what changes in a browser, and the calling convention of
  the Claude in Chrome extension.
- [](/docs/agents_live_model): the working reference for `jb`, the live model
  and direct data access. Inside Desktop the same page is
  `docs topic:"live-model"`.
- [](/docs/agents_recipes): one verified snippet per ask, from tabulating what
  is on screen to a figure per locus. Inside Desktop, `docs topic:"recipes"`.
- [](/docs/agents_hosted_data): every UCSC and GenArk assembly as a ready
  config, and how to find a track id or put your own file on top.
- [](/docs/agents_capture): rendering a view to an image from a script, and
  knowing when it has finished drawing.

Every tutorial on this site was written with an agent in the loop, fetching and
subsetting the data, authoring the config, rendering the figure, then reading
the figure back to check the prose. Their `## Reproduce it end to end` sections
are the scripts it produced.
