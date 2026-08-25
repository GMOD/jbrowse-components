---
name: jbrowse-authoring
description:
  Use when authoring a JBrowse 2 config.json, session, or track from scratch —
  including fetching and indexing the data files first — or when asked to
  build/show/open a genome-browser view of some data, add a track, set up a
  demo, or check that a JBrowse config is correct. Covers the config shape, the
  session spec, and a validator that catches the config errors JBrowse itself
  accepts silently.
---

# Authoring JBrowse sessions

JBrowse's automation interface is a **file format**, not an API. You describe
the session you want as JSON and open it. There is no plugin to install and no
running instance to drive.

That means anything you can reach with a shell is in scope: fetch a file, slice
it, index it, write a config that points at it, open it. Automation confined to
an already-open session can only rearrange tracks someone else configured — this
is the other thing.

## The loop

```
1. get data       curl / aws s3 cp / samtools view -b <region>
2. make loadable  bgzip + tabix, samtools index, jbrowse add-assembly
3. author         write config.json  (the whole "API")
4. validate       jbrowse validate config.json
5. open           jbrowse-desktop config.json
6. verify         look at it — screenshot, or read the session state back
```

Steps 4 and 5 are the ones people skip. Don't. Step 4 catches a class of error
nothing downstream reports (below), and step 6 is the only thing that
distinguishes "config loaded" from "the track has data in it".

**Before step 1, check whether the assembly already exists.** Every UCSC and
GenArk genome is published as a ready-made config at genomes.jbrowse.org, with
its sequence, refName aliases, cytobands, track catalog and gene search index —
and your own file can ride on top of it as a session track with no config
authored at all. See the `jbrowse-hosted-data` skill. Downloading and indexing
hg38 to show a gene is the most common way to turn a short task into a long one.

For step 6, see the `jbrowse-capture` skill: `@jbrowse/img` renders without a
browser, `@jbrowse/capture` drives a real one and knows when it has finished.

## Minimum viable config

```json
{
  "assemblies": [
    {
      "name": "hg38",
      "sequence": {
        "type": "ReferenceSequenceTrack",
        "trackId": "hg38-ref",
        "adapter": { "type": "BgzipFastaAdapter", "uri": "hg38.fa.gz" }
      }
    }
  ],
  "tracks": [
    {
      "type": "AlignmentsTrack",
      "trackId": "sample_bam",
      "name": "Sample",
      "assemblyNames": ["hg38"],
      "adapter": { "type": "BamAdapter", "uri": "sample.bam" }
    }
  ],
  "defaultSession": {
    "name": "demo",
    "views": [
      {
        "type": "LinearGenomeView",
        "init": {
          "assembly": "hg38",
          "loc": "chr1:1-100000",
          "tracks": ["sample_bam"]
        }
      }
    ]
  }
}
```

Four things carry all the weight:

- **A track is one adapter (where the data is) plus display(s) (how it is
  drawn).** Pick the adapter from the file type, and the track type follows.
- **`uri` is a shorthand** most adapters accept in place of the explicit
  location slot, and it derives the index location too (`sample.bam` →
  `sample.bam.bai`). Use it. `references/config-types.md` marks which adapters
  take it.
- **A whole track can be `{ "trackId", "uri" }`**: the type and adapter come
  from the extension, `name` from the file name, and `assemblyNames` from the
  config when it has exactly one assembly. Write a key beside `uri` to override
  any of them. Reach for the full form when the extension is ambiguous or the
  file needs a slot the guess cannot set.
- **`defaultSession.views[].init`** is what makes the config open onto something
  instead of an empty browser. Same fields whether they arrive via config, URL,
  or embedded props — see `references/session-spec.md`.
- **Relative `uri`s resolve against the config file's location**, so a config
  next to its data files just works.

## Validate before opening

```bash
npm install -g @jbrowse/cli   # if it isn't already
jbrowse validate config.json
# --json for machine-readable output; exits 1 when there are errors
```

Run it after every edit. It is fast, needs no data files present, and exists to
catch what JBrowse won't tell you:

> **MST ignores snapshot keys it doesn't declare.** Write `bamLocatoin`, or a
> `renderers: {...}` block from a 2022 config, and nothing anywhere complains —
> the config loads, the track appears, and your setting silently does nothing.

That is the single most common way an authored config is wrong, and the only
symptom is "it rendered but not how I asked". The validator's error/warning
split is drawn on exactly this line:

|             | meaning                                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **error**   | JBrowse accepts it and silently does the wrong thing — unknown slot, dangling `trackId`/assembly reference, duplicate `trackId` |
| **warning** | JBrowse will tell you itself on load — unknown type name, legacy key a migration rewrites                                       |

So: fix every error. Read the warnings and decide.

Types registered by a **plugin** aren't in the manifest, so they surface as
unknown-type warnings — expected, not a problem. Legacy type names a current
type still answers to (`LinearPileupDisplay`, `LinearFeatureDisplay`) are
resolved through their `aliases` and checked against the type that absorbed
them, so those are not flagged.

The slot manifest it checks against is generated from the live schemas and rides
`pnpm autogen`, so it can't drift from a schema change on main. Working in the
monorepo and just edited a `configSchema.ts`? Regenerate it:

```bash
node --experimental-strip-types scripts/generateConfigManifest.ts
```

## Looking things up

Don't guess slot names — the whole point of the validator is that guesses fail
silently, and this is cheaper than a round trip through it.

1. `references/config-types.md` — every track, display, and adapter type the
   core plugins register, one line each. Start here to pick a type. Starting
   from a **file** rather than a type instead?
   `https://jbrowse.org/jb2/docs/config_guides/file_types.md` is format →
   adapter → track type per row, including the notes that decide between two
   adapters for one format.
2. Then fetch that type's page for its slots:
   `https://jbrowse.org/jb2/docs/config/<lowercased type name>.md` (a few
   hundred tokens each). The index links them.
3. `https://jbrowse.org/jb2/docs/llms.txt` indexes the rest of the docs if you
   need concepts rather than slots.

## Opening what you authored

**Desktop** takes a config or session path directly, and a second invocation
retargets the window that is already open rather than starting a new app:

```bash
jbrowse-desktop config.json
```

**Web** takes the same session description in the URL, as
`?config=<url>&session=spec-<uri-encoded JSON>` — see
`references/session-spec.md`.

To **verify** rather than assume, read `window.JBrowseSession` — the live
session model, exposed in both desktop and web — and check that the tracks you
named are the ones actually open. Launch Desktop with
`--remote-debugging-port=9222` and attach, or let `@jbrowse/capture` do it
against web:

```bash
npx @jbrowse/capture --config <url> --assembly <name> --loc <where> --track <id> -o out.png
```

It gates on exactly that model read, so a trackId the config does not define
fails loudly instead of producing a picture of an empty browser. The
`jbrowse-capture` skill explains why that gate is necessary and what to do
without it.

## Things that bite

- **A track referencing an assembly that isn't defined** loads and then fails to
  display, with no obvious error. The validator checks this.
- **`init.tracks` naming a `trackId` that doesn't exist** silently opens
  nothing. Also checked.
- **Duplicate `trackId`** — the later one wins, quietly.
- **A config that loads fine can still show an empty track**, when the file is
  unindexed, the refNames don't match the assembly (`chr1` vs `1`), or the
  region has no data. No validator catches this; only looking at it does.
