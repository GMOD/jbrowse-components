---
title: Config and session JSON
description:
  The one JSON document every JBrowse surface takes — config file, link,
  embedded app, CLI — and where its reference, recipes, and validator live
---

A JBrowse session is one JSON document: the genomes, the tracks and where their
data lives, and the views that are open. Every surface takes the same document:

| Surface                                            | How it takes the document                                       |
| -------------------------------------------------- | --------------------------------------------------------------- |
| [jbrowse-web](/docs/quickstart_web)                | `config.json` beside the app, or `?config=` pointing at one     |
| a link to jbrowse-web                              | `&session=`, or the per-view parameters in [](/docs/urlparams)  |
| [jbrowse-desktop](/docs/quickstart_desktop)        | an opened `.jbrowse` file: the same format with a session in it |
| [embedded components](/docs/embedded_components)   | the object passed to `createViewState`                          |
| [](/docs/jbrowser) and [](/docs/jbrowse_anywidget) | what the helper functions assemble for you                      |
| [@jbrowse/img](/docs/jbrowse-img)                  | `--config`, and `--spec` for a whole session                    |

A running JBrowse also takes it a piece at a time, one assembly or track pasted
in. Every config block in these docs has that route on its own tab beside the
file and the CLI command.

## What a session document contains

A genome, a track, and the view to open on:

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
        "assembly": "hg38",
        "loc": "chr17:43,044,295-43,170,245",
        "tracks": ["ncbi_genes"]
      }
    ]
  }
}
```

`assemblies` and `tracks` are enough on their own; `defaultSession` only says
what to open on load. [](/docs/config_guides/intro) covers the other top-level
fields (`plugins`, `connections`, `internetAccounts`,
`aggregateTextSearchAdapters`, `configuration`),
[](/docs/config_guides/default_session) the session object, and
[](/docs/automating) the fields a view takes.

## How the config and the session fit together

**The config is the catalog. The session says what is open.** A session names a
track by its `trackId`: the `"ncbi_genes"` in the view's `tracks` above is the
`trackId` of the track defined above it. Delete the track and the session names
something that does not exist, which [`jbrowse validate`](#checking-a-document)
reports.

**Write the short form above.** The app's export-session option writes a raw
state snapshot instead, with every view, track and display spelled out and an
`id` on everything. Reach for that only to recover a view you built by clicking.

**The config holds the settings; the session holds the state.** Color, height,
display mode, color-by and filters are
[configuration slots](/docs/config_guides/tracks) and belong on the track under
`displayDefaults`. What is open, where it is scrolled to and how the panels are
arranged is session state.

A view can still set a display option per launch by writing the track entry as
an object: `{ "trackId": "ncbi_genes", "height": 250 }`. The view resolves that
entry, so the slot lands on the display's config.

The same `"height": 250` on a raw snapshot's display node does nothing. A
snapshot node takes only the display state model's properties (`id`, `type`,
`configuration`) and drops the rest without warning. `jbrowse validate` names
the key and says where it belonged.

**A session can carry tracks of its own.** `sessionTracks` takes the same track
configs as `tracks`, but they travel with the session and never reach the
server's `config.json`. It is how a link adds a track to somebody else's
instance.

**On desktop the halves are one file.** A `.jbrowse` file is this document with
the session saved into it.

**The two are edited the same way.** Track settings are the slots the track menu
writes, so a setting found by clicking has a name you can write into the config.
See [](/docs/config_guides/default_session).

## Where the document comes from

A track is an id, a uri and the assembly it sits on; the type and adapter come
from the file extension, and with one assembly declared the track need not name
it (see [the shortest track](/docs/config_guides/tracks#the-shortest-track)). A
view is an assembly, a locus and a list of tracks. Things that write it for you:

- [`@jbrowse/cli`](/docs/cli): `jbrowse add-assembly` and `jbrowse add-track`
  append to `config.json`, inferring the track type and adapter from the file
- **The app**, for the session part. Set the view up by clicking; the URL bar
  shows the assembly, locus and track ids a view needs, and
  `jbrowse set-default-session` installs a session file into a config. See
  [](/docs/config_guides/default_session)
- **A track hub**, which needs no file at all. `&hubURL=` loads a
  [UCSC track hub](/docs/user_guides/hub_url) from a link, and
  [](/docs/config_guides/connections) makes that permanent
- **A script**, for many tracks. See [](/docs/config_guides/deploying)

## Opening the document, from a file or a link

Save the example as `hg38.json` next to jbrowse-web and it opens on the
`defaultSession`. The same fields also go on the URL, to send someone a
different gene or a different set of tracks:

```
?config=hg38.json&assembly=hg38&loc=chr17:43,044,295-43,170,245&tracks=ncbi_genes
```

The config supplies the assemblies and track definitions; the URL says which to
open, and where. [](/docs/urlparams) lists every parameter and
[](/docs/automating) the fields they set.

For a view those parameters cannot describe (several views, a dotplot, tracks
that exist only in that link), the URL carries a whole session as JSON, a
[session spec](/docs/urlparams#session-spec). A spec writes a view exactly as a
`defaultSession` does.

## The generated slot and model reference

Every configuration type (adapter, track, display, connection, internet account)
has a page under [](/docs/config) listing its slots, types and defaults, and
every state model has one under [](/docs/models). Both are generated from the
source on every build.

Two pages sit between those and a file you are writing:

- [](/docs/config_guides/file_types) maps a file format to the adapter that
  reads it, and so to the config page to open
- [](/docs/config_guides/slot_types) says what a slot's **Type** column accepts:
  a `fileLocation`, a `stringEnum`, a `frozen`

A slot can also be computed per feature: [](/docs/config_guides/jexl). To add
types of your own, see [](/docs/developer_guides/configuration_schema).

## Checking a document

```bash
jbrowse validate config.json
```

The [validate command](/docs/cli#jbrowse-validate) checks a config or a saved
`.jbrowse` session against those same schemas. It catches what JBrowse itself
ignores: a misspelled slot, a track naming an undefined assembly, a
`defaultSession` naming a `trackId` that does not exist.

## More examples

The [](/docs/cookbook) is whole configs short enough to copy. The
[tutorials](/docs/tutorials) run end to end from public data. The
[config guide](/docs/config_guide) has a page per track type.

Nearly every figure on this site is rendered from one of these documents, which
is why most carry an "Open this view in JBrowse" link.

## Drawing the document as a static image

`jb2export`, installed by [@jbrowse/img](/docs/jbrowse-img), takes the same
config, assembly, location and tracks and writes SVG, PNG or PDF:

```bash
jb2export --config hg38.json --assembly hg38 \
  --loc chr17:43,044,295-43,170,245 --track ncbi_genes --out brca1.png
```

## See also

- [](/docs/config_guide) — how to configure each part of the file
- [](/docs/cookbook) — recipes short enough to copy
- [](/docs/config) — generated slot reference, one page per type
- [](/docs/urlparams) — the same session expressed in a link
- [](/docs/automating) — the launch fields every surface shares
- [](/docs/cli) — the commands that write the file for you
- [](/docs/embedded_components) — the same document in your own React app
