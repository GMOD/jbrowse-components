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
