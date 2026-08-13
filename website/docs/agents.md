---
title: Using JBrowse with AI agents
sidebar_label: Overview
description:
  How to have an AI coding agent build JBrowse views, what to give it to read,
  and how to check what it produced
---

JBrowse's automation interface is a **file format**, not an API. A session is
described as JSON and opened; there is no plugin to install and no running
instance to drive. That makes it a good target for an AI coding agent, which is
already good at writing JSON against a schema and running shell commands.

Two more things make it a good target, and they are the subject of the two pages
next to this one. There is a large body of **hosted, ready-to-use genomic data**
an agent can reach with no setup at all, so the first useful picture does not
wait on a download — see [](/docs/agents_hosted_data). And a finished view can
be **captured and looked at**, which is what closes the loop between "the agent
wrote a config" and "the config shows the thing" — see [](/docs/agents_capture).

Every tutorial on this site was written with an agent in the loop: fetching and
subsetting the data, authoring the config, rendering the figure, then reading
the figure back to check the claim in the prose. The pages under
[Tutorials](/docs/tutorials) are worked examples of that loop as much as they
are of the biology, and their `## Reproduce it end to end` sections are the
scripts it produced.

## The loop

An agent with a shell can do the whole job, not just the last step:

```
1. get data       curl / aws s3 cp / samtools view -b <region>
2. make loadable  bgzip + tabix, samtools index, jbrowse add-assembly
3. author         write config.json
4. check          jbrowse validate config.json
5. open           jbrowse-desktop config.json
6. look           screenshot it, and read the picture
```

Steps 1 and 2 are the reason this belongs in a shell rather than in the browser:
fetching a file, slicing a region out of a BAM, and building an index are not
things a web page can do. Step 3 is a JSON file — see [](/docs/automating) for
the fields, and [](/docs/config_guide) for the model.

Steps 1 to 3 are also the ones you can often skip entirely. If the assembly is
one of the hosted ones, and the annotation you want is already published against
it, the whole job is a URL.

## Let the CLI write the track

`@jbrowse/cli` knows the slot names, which is the thing an agent authoring JSON
from memory does not:

```bash
jbrowse add-assembly hg38.fa.gz --load copy
jbrowse add-track sample.bam --load copy --name Sample --color darkred
jbrowse add-track https://example.org/genes.gff3.gz --height 200
jbrowse text-index --tracks genes    ## makes a gene name work as a location
```

The track type, the adapter and the index path all come from the file itself: a
`.bw` becomes a `QuantitativeTrack` over a `BigWigAdapter`, a `.vcf.gz` a
`VariantTrack` over a `VcfTabixAdapter`. `--color`, `--height` and
`--displayDefaults` are written into the track's `displayDefaults`, which is
where per-track appearance belongs. `--load` says how a local file is placed
next to the config and is omitted for a URL; `--config` takes inline JSON for
anything the flags do not cover. Full reference in [](/docs/cli).

What the CLI does not write is what the view opens onto — `defaultSession` and
the `init` fields under it, which are [](/docs/automating), and which
`jbrowse set-default-session` will take once composed.

## Check the result

The one thing to insist on is step 4, because of how JBrowse fails:

> **A config key JBrowse does not recognize is ignored, not reported.** A
> misspelled slot leaves the track loading normally with the setting doing
> nothing.

That failure is invisible to the agent — it wrote a config, the config loaded,
the track appeared. Nothing anywhere says the color it set is being dropped. So
give it a way to find out:

```bash
jbrowse validate config.json
```

```
error: tracks[0].adapter.bamLocatoin: unknown slot "bamLocatoin" — did you mean "bamLocation"? — JBrowse ignores keys it does not declare, so this setting silently does nothing
error: defaultSession.views[0].init.tracks[0]: trackId "sample_bem" is not defined in this config — did you mean "sample_bam"?

2 error(s), 0 warning(s) in config.json
```

`--json` gives machine-readable output, and a non-zero exit means errors, so an
agent can loop on it. Errors are things JBrowse accepts and silently gets wrong;
warnings are things it will complain about itself. Full description in
[](/docs/faq#my-track-loads-but-my-setting-has-no-effect).

A validator beats a manual here. An agent that has read every page can still
invent a slot name; one that can check its work recovers from having done so.

## Then look at it

The validator reads the config. It cannot tell you the file was unindexed, the
refNames did not match, or the region has no data — all of which produce a track
that loads and shows nothing. Only the picture says that:

```bash
## a static render, no browser involved
npx @jbrowse/img --hub hg38 --track hg38-ncbiRefSeqCurated --loc BRCA1 --out out.png

## the real app, driven with puppeteer, waited on properly
npx @jbrowse/capture --hub hg38 --track hg38-ncbiRefSeqCurated --loc BRCA1 -o out.png
```

Both are covered in [](/docs/agents_capture), including which one to reach for.
An agent that can read images should read the one it just produced; an empty
track is obvious in a picture and invisible in an exit code.

### When the track is empty

The picture says a track has nothing in it. What it does not say is which of
three things is true, and each has a shell answer:

```bash
## 1. what the file calls its contigs, against what the assembly calls them
samtools idxstats sample.bam | cut -f1
tabix -l variants.vcf.gz
cut -f1 hg38.fa.fai

## 2. whether the region holds anything
samtools view -c sample.bam chr17:43044000-43126000
tabix variants.vcf.gz chr17:43044000-43126000 | head

## 3. whether the server serves the file the way the browser reads it
curl -sI -H 'Range: bytes=0-99' https://example.org/sample.bam
```

The first is the usual one. JBrowse matches reference names exactly, so a file
naming its first chromosome `1` shows nothing on an assembly that calls it
`chr1`, with no error anywhere. The fix is an alias table on the assembly —
`jbrowse add-assembly --refNameAliases`, or a hosted hub, which ships one — and
not a rewrite of the file.

The third has to come back `206 Partial Content` with an
`Access-Control-Allow-Origin` the browser will accept. A `200` carrying the
whole file is a server ignoring the range, which turns every read into a full
download rather than showing an error. The FAQ covers the same two for someone
with the app in front of them:
[an empty track](/docs/faq#my-track-loads-but-shows-no-features) and
[a CORS error](/docs/faq#why-do-i-get-a-cors-error-when-loading-remote-files).

## What to give an agent to read

The docs are large, so don't paste them. Every page is served as raw Markdown at
its `.md` URL, and <https://jbrowse.org/jb2/docs/llms.txt> is an index of all of
them — small enough to read whole, with a link per page to fetch on demand.

For config authoring specifically, the useful path is:

1. `llms.txt` to find the type.
2. `https://jbrowse.org/jb2/docs/config/<lowercased type name>.md` for the slots
   that type accepts — one page per adapter, track, and display type, generated
   from the schemas, a few hundred words each.
3. [](/docs/automating) for the `init` fields that decide what a view opens
   onto.
4. [](/docs/cookbook) when the request is about how something should look rather
   than which type it is — color callbacks, filters, arcs, several signals on
   one track — each recipe a whole track config rather than the slot on its own.

## Ready-made skills

Three [Claude Code skills](https://docs.claude.com/en/docs/claude-code/skills)
package the above. They ship in
[jbrowse-components](https://github.com/GMOD/jbrowse-components) under
`.claude/skills/`, and are mirrored to
[cmdcolin/jbrowse-skills](https://github.com/cmdcolin/jbrowse-skills) so you can
install them into your own project without cloning the monorepo:

```bash
mkdir -p .claude/skills
curl -sL https://github.com/cmdcolin/jbrowse-skills/archive/refs/heads/main.tar.gz |
  tar -xz --strip-components=2 -C .claude/skills jbrowse-skills-main/skills
```

That repo's README gives `git` and `degit` equivalents, and the same commands
narrowed to a single skill.

| Skill                                 | For                                                                                                                                       |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `.claude/skills/jbrowse-authoring/`   | writing a config or session from scratch: the procedure, an index of every registered type, the session-spec reference, and the validator |
| `.claude/skills/jbrowse-hosted-data/` | finding and using the hosted assemblies and tracks, and adding your own file alongside them                                               |
| `.claude/skills/jbrowse-capture/`     | driving a real instance and screenshotting it, including what "finished rendering" means                                                  |

Nothing in them is Claude-specific except the file layout — the reference files
are plain Markdown and work as context for any assistant. `AGENTS.md` files in
the source tree cover the same ground for agents working _on_ JBrowse rather
than _with_ it.

The mirror is generated, so edit the skills in jbrowse-components. The authoring
skill's type index in particular is built from the live config schemas by
`pnpm autogen`, which is what stops it listing a slot that no longer exists.

## What agents get wrong

In rough order of frequency:

- **Inventing a slot name.** Covered above; this is what `jbrowse validate` is
  for.
- **Pointing a track at an assembly the config never defines.** Also caught.
- **A config that loads but shows an empty track.** No validator catches this —
  the file may be unindexed, the refNames may not match the assembly (`chr1` vs
  `1`), or the region may genuinely have no data. Have the agent look at the
  result, not just at the exit code.
- **Screenshotting before the browser has finished.** Every readiness signal
  JBrowse publishes is the _absence_ of something, so all of them pass on a page
  that has not started yet, and a naive script reports success in under a
  second. [](/docs/agents_capture#knowing-when-it-is-done) is about exactly
  this.
- **Building an assembly that already exists.** Downloading and indexing a
  reference genome is a slow way to arrive at something already hosted and
  CORS-enabled — see [](/docs/agents_hosted_data).
- **Setting display options on the track instead of the display.** Per-track
  height and color live on the display; `displayDefaults` is the shorthand that
  routes them there without naming a display type.
- **Handing the browser a path instead of a URL.** A track is fetched by the
  page, in range requests, so a local file needs a server in front of it — any
  static one that honors `Range` — or Desktop, which opens a path directly. A
  `file://` uri and a bare path both reach jbrowse-web as a failed fetch.
