---
title: Using JBrowse with AI agents
sidebar_label: AI agents
description:
  How to have an AI coding agent build JBrowse configs and sessions, what to
  give it to read, and how to check what it produced
---

JBrowse's automation interface is a **file format**, not an API. A session is
described as JSON and opened; there is no plugin to install and no running
instance to drive. That makes it a good target for an AI coding agent, which is
already good at writing JSON against a schema and running shell commands.

This page covers what to point an agent at, and how to check what it wrote.

## The loop

An agent with a shell can do the whole job, not just the last step:

```
1. get data       curl / aws s3 cp / samtools view -b <region>
2. make loadable  bgzip + tabix, samtools index, jbrowse add-assembly
3. author         write config.json
4. check          jbrowse validate config.json
5. open           jbrowse-desktop config.json
```

Steps 1 and 2 are the reason this belongs in a shell rather than in the browser:
fetching a file, slicing a region out of a BAM, and building an index are not
things a web page can do. Step 3 is a JSON file — see [](/docs/automating) for
the fields, and [](/docs/config_guide) for the model.

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

## A ready-made skill

The repo ships a
[Claude Code skill](https://docs.claude.com/en/docs/claude-code/skills) at
`.claude/skills/jbrowse-authoring/` that packages the above: the procedure, an
index of every registered type, and the session-spec reference. Clone
[jbrowse-components](https://github.com/GMOD/jbrowse-components) and it is
available in that repo; copy the directory into another project's `.claude/` to
use it elsewhere. Nothing in it is Claude-specific except the file layout — the
reference files are plain Markdown and work as context for any assistant.

## What agents get wrong

In rough order of frequency:

- **Inventing a slot name.** Covered above; this is what `jbrowse validate` is
  for.
- **Pointing a track at an assembly the config never defines.** Also caught.
- **A config that loads but shows an empty track.** No validator catches this —
  the file may be unindexed, the refNames may not match the assembly (`chr1` vs
  `1`), or the region may genuinely have no data. Have the agent look at the
  result, not just at the exit code.
- **Setting display options on the track instead of the display.** Per-track
  height and color live on the display; `displayDefaults` is the shorthand that
  routes them there without naming a display type.
