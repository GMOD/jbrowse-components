---
title: Config and session JSON
description:
  The one JSON document every JBrowse surface takes — config file, link,
  embedded app, CLI — and where its reference, recipes, and validator live
---

A JBrowse session is a JSON document: the genomes loaded, the tracks and where
their data lives, and the views that are open, at what locus, with which
settings. You write or generate it and open it.

The same document is what every surface takes:

| Surface                                            | How it takes the document                                       |
| -------------------------------------------------- | --------------------------------------------------------------- |
| [jbrowse-web](/docs/quickstart_web)                | `config.json` beside the app, or `?config=` pointing at one     |
| a link to jbrowse-web                              | `&session=`, or the per-view parameters in [](/docs/urlparams)  |
| [jbrowse-desktop](/docs/quickstart_desktop)        | an opened `.jbrowse` file: the same format with a session in it |
| [embedded components](/docs/embedded_components)   | the object passed to `createViewState`                          |
| [](/docs/jbrowser) and [](/docs/jbrowse_anywidget) | what the helper functions assemble for you                      |
| [@jbrowse/img](/docs/jbrowse-img)                  | `--config`, and `--spec` for a whole session                    |

## What a session document contains

The genome, a track, and the view to open on:

```json
{
  "assemblies": [
    {
      "name": "hg38",
      "uri": "https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz"
    }
  ],
  "tracks": [
    {
      "type": "FeatureTrack",
      "trackId": "ncbi_genes",
      "name": "NCBI RefSeq genes",
      "assemblyNames": ["hg38"],
      "adapter": {
        "type": "Gff3TabixAdapter",
        "uri": "https://jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz"
      }
    }
  ],
  "defaultSession": {
    "name": "BRCA1",
    "views": [
      {
        "type": "LinearGenomeView",
        "init": {
          "assembly": "hg38",
          "loc": "chr17:43,044,295-43,170,245",
          "tracks": ["ncbi_genes"]
        }
      }
    ]
  }
}
```

`assemblies` and `tracks` are the two fields that matter; a file with just those
works, and `defaultSession` only says what to open on load.
[](/docs/config_guides/intro) covers both, along with the optional top-level
fields beside them — `plugins`, `connections`, `internetAccounts`,
`aggregateTextSearchAdapters`, `configuration` — each with a guide of its own.
[](/docs/config_guides/default_session) covers the session object and
[](/docs/automating) the `init` block.

## How the config and the session fit together

They are two halves of one document, and each thing belongs in one half or the
other.

**The config is the catalog. The session says what is open.** A session names a
track by the `trackId` the config gave it. In the example above the whole join
is one string: the `"ncbi_genes"` in the view's `init.tracks` is the `trackId`
of the track defined above it. Delete that track from `tracks` and the session
is left naming something that does not exist, which is one of the things
[`jbrowse validate`](#checking-a-document) reports.

**Write the `init` form.** The app's export-session option writes the other one:
a raw state snapshot with every view, track and display spelled out, the same
track named as `"configuration": "ncbi_genes"` and an `id` on everything —
dozens of lines for what `init` says in four, and harder to edit afterwards.
Prefer `init` for anything you write or generate yourself, and reach for the
exported snapshot to recover a view you built by clicking.

**The config holds the settings; the session holds the state.** Color, height,
display mode, color-by and filters are
[configuration slots](/docs/config_guides/tracks) — they belong on the track in
the config, under `displayDefaults`. What is open, where it is scrolled to and
how the panels are arranged is session state. So one view has its appearance
described in one half of the document and its position in the other.

An `init` entry can still set a display option per launch: write the entry as an
object instead of a string — `{ "trackId": "ncbi_genes", "height": 250 }` — and
the slot is routed onto the display's config, because those entries are
arguments to the view's launcher.

That same `"height": 250` on a raw snapshot's display node does nothing at all.
A snapshot node is instantiated by the display's **state model**, so it takes
that model's properties — `id`, `type`, `configuration` — and drops everything
else, and `height` is a config slot rather than a property. Nothing warns you;
the track just opens at its default height. `jbrowse validate` reports the key
by name and says which of the two places it belonged in.

**A session can carry tracks of its own.** `sessionTracks` takes the same track
configs the top-level `tracks` array takes, but they belong to that session:
they travel with it when it is shared or saved, and never reach the
`config.json` the server hands every visitor. It is how a link adds a track to
somebody else's instance.

**On desktop the halves are stored as one file.** A `.jbrowse` file is this same
document with the session saved into it, which is why opening one restores the
tracks and the view together.

**And the two are edited the same way.** Track settings are the same slots the
track menu writes, so a setting you find by clicking around has a name you can
write into the config — see [](/docs/config_guides/default_session).

## Where the document comes from

It is a small enough format to write, and to generate — a track is an id, a uri
and the assembly it sits on, with the type and adapter read off the file's
extension, and where the config declares one assembly the track need not name it
(see [the shortest track](/docs/config_guides/tracks#the-shortest-track)). A
view is an `init` block. Several things will also write parts of it for you:

- [`@jbrowse/cli`](/docs/cli) writes it. `jbrowse add-assembly` and
  `jbrowse add-track` append to `config.json`, inferring the track type and the
  adapter from the file you hand them.
- **The app tells you what to put in the session part.** Set the view up by
  clicking; the assembly, locus and track ids you land on are what an `init`
  block needs, and the URL bar is already showing them.
  `jbrowse set-default-session` installs a session file into a config. See
  [](/docs/config_guides/default_session).
- **A track hub needs no config file at all.** `&hubURL=` loads a
  [UCSC track hub](/docs/user_guides/hub_url) straight from a link, supplying
  its own assemblies and tracks, and [](/docs/config_guides/connections) makes
  that permanent in a file.
- **For a lot of tracks, generate it.** [](/docs/config_guides/deploying) covers
  building `config.json` from a script.

## Opening the document, from a file or a link

Save that as `hg38.json` next to jbrowse-web and it opens on it: the
`defaultSession` is the view you land on.

That fixes the view in the file. The same fields also go on the URL, to send
someone a different gene or a different set of tracks — `init` names an
assembly, a location and a list of tracks, and jbrowse-web reads all three as
query parameters.

```
?config=hg38.json&assembly=hg38&loc=chr17:43,044,295-43,170,245&tracks=ncbi_genes
```

The config still supplies the assemblies and the track definitions; the URL says
which of them to open, and where. [](/docs/urlparams) lists every parameter and
[](/docs/automating) covers the `init` fields they set.

For a view those parameters cannot describe — several views at once, a dotplot,
tracks that exist only in that link — the URL carries a whole session as JSON, a
[session spec](/docs/urlparams#session-spec). A spec lists a view's launch keys
flat, because there they are arguments to the view's launcher; a
`defaultSession` view is a saved state snapshot and those keys sit under `init`.
Moving a view between the two means reshaping it.

## The generated slot and model reference

Every configuration type — each adapter, track, display, connection, and
internet account — has a page under [](/docs/config) listing its slots, their
types and their defaults, and every state model has one under [](/docs/models).
Both are generated from the definitions in the source on every build, so they
describe the release you are running.

Two pages sit between those and a file you are writing:

- [](/docs/config_guides/file_types) maps a file format to the adapter that
  reads it, which is what tells you which of those config pages to open.
- [](/docs/config_guides/slot_types) says what a slot's **Type** column accepts:
  what to write for a `fileLocation`, a `stringEnum`, or a `frozen`.

A slot's value can also be computed per feature rather than fixed: see
[](/docs/config_guides/jexl). If you are adding types of your own,
[](/docs/developer_guides/configuration_schema) is how the schemas these pages
are generated from get declared.

## Checking a document

```bash
jbrowse validate config.json
```

The [validate command](/docs/cli#jbrowse-validate) checks a config or a saved
`.jbrowse` session against a manifest generated from those same schemas. It
catches what JBrowse itself ignores: a misspelled slot that leaves the setting
doing nothing, a track naming an assembly that is not defined, a
`defaultSession` naming a `trackId` that does not exist.

## More examples

The [](/docs/cookbook) is whole configs short enough to copy — the smallest one
that works, then the settings people reach for most. The
[tutorials](/docs/tutorials) run end to end from public data, config and all.
For the settings specific to one kind of data, the
[config guide](/docs/config_guide) has a page per track type.

Nearly every figure on this site is rendered from one of these documents, which
is why most carry an "Open this view in JBrowse" link: the image and the live
session come from the same spec.

## Drawing the document as a static image

The same document renders headlessly. `jb2export`, the command installed by
[@jbrowse/img](/docs/jbrowse-img), takes the same config and the same assembly,
location and tracks, and writes SVG, PNG or PDF:

```bash
jb2export --config hg38.json --assembly hg38 \
  --loc chr17:43,044,295-43,170,245 --track ncbi_genes --out brca1.png
```

## See also

- [](/docs/config_guide) — how to configure each part of the file
- [](/docs/cookbook) — recipes short enough to copy
- [](/docs/config) — generated slot reference, one page per type
- [](/docs/urlparams) — the same session expressed in a link
- [](/docs/automating) — the `init` fields every launch surface shares
- [](/docs/cli) — the commands that write the file for you
- [](/docs/embedded_components) — the same document in your own React app
