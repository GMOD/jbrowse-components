---
title: The JSON schema
sidebar_label: JSON schema
description:
  One JSON format describes a whole JBrowse session, and every type in it has a
  reference page generated from the source schemas
---

A JBrowse session is a JSON document: the genomes loaded, the tracks and where
their data lives, and the views that are open, at what locus, with which
settings. You write or generate it and open it. There is no setup API to call.

The same document is what every surface takes, so a config written for one of
them is not rewritten for the next:

| Surface                                                 | How it takes the document                                      |
| ------------------------------------------------------- | -------------------------------------------------------------- |
| [jbrowse-web](/docs/quickstart_web)                     | `config.json` beside the app, or `?config=` pointing at one      |
| a link to jbrowse-web                                   | `&session=`, or the per-view parameters in [](/docs/urlparams)   |
| [jbrowse-desktop](/docs/quickstart_desktop)             | an opened `.jbrowse` file: the same format with a session in it  |
| [embedded components](/docs/embedded_components)        | the object passed to `createViewState`                           |
| [](/docs/jbrowser) and the [Python anywidget](/docs/jbrowse_jupyter) | what the helper functions assemble for you          |
| [@jbrowse/img](/docs/jbrowse-img)                       | `--config`, and `--spec` for a whole session                     |

## What is in it

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

Track settings — height, color-by, filters, display mode — are configuration
slots, the same ones the track menu writes, so a view set up by clicking around
exports to JSON and pastes back in as a `defaultSession`.

## Where one comes from

You rarely write the whole thing by hand:

- [`@jbrowse/cli`](/docs/cli) writes it. `jbrowse add-assembly` and
  `jbrowse add-track` append to `config.json`, inferring the track type and the
  adapter from the file you hand them.
- **The app writes the session part.** Set the view up by clicking, then use its
  export session option and paste the exported `"session"` object in as
  `"defaultSession"` — or have `jbrowse set-default-session` do it. See
  [](/docs/config_guides/default_session).
- **A track hub needs no config at all.** `&hubURL=` loads a
  [UCSC track hub](/docs/user_guides/hub_url) straight from a link, and
  [](/docs/config_guides/connections) makes that permanent in a file.
- **For a lot of tracks, generate it.** [](/docs/config_guides/deploying) covers
  building `config.json` from a script.

## Opening it, from a file or a link

Save that as `hg38.json` next to jbrowse-web and it opens on it: the
`defaultSession` is the view you land on.

That fixes the view in the file. To send someone a different gene, or a
different set of tracks, without editing the file, the same fields go on the URL
instead — `init` names an assembly, a location and a list of tracks, and
jbrowse-web reads all three as query parameters.

```
?config=hg38.json&assembly=hg38&loc=chr17:43,044,295-43,170,245&tracks=ncbi_genes
```

The config still supplies the assemblies and the track definitions; the URL says
which of them to open, and where. [](/docs/urlparams) lists every parameter and
[](/docs/automating) covers the `init` fields they set.

For a view those parameters cannot describe — several views at once, a dotplot,
tracks that exist only in that link — the URL carries a whole session as JSON, a
[session spec](/docs/urlparams#session-spec). A spec is not the `defaultSession`
shape: it lists a view's launch keys flat, because there they are arguments to
the view's launcher, whereas a `defaultSession` view is a saved state snapshot
and those keys sit under `init`. Moving a view between the two means reshaping
it.

## The reference is generated from the source

Every configuration type — each adapter, track, display, connection, and
internet account — has a page under [](/docs/config) listing its slots, their
types and their defaults, and every state model has one under [](/docs/models).
Both are generated from the definitions in the source on every build, so they
describe the release you are running rather than the release someone documented.

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

## Drawing one as a static image

The same document renders headlessly. `jb2export`, the command installed by
[@jbrowse/img](/docs/jbrowse-img), takes the same config and the same assembly,
location and tracks, and writes SVG, PNG or PDF with no browser in the loop:

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
