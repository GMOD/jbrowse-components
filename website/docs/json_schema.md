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

The same document is what every surface takes:

- `config.json` next to jbrowse-web, or a `.jbrowse` file on jbrowse-desktop
- `?config=` and `&session=` on a URL, see [](/docs/urlparams)
- the object `createViewState` takes in the embedded components, see
  [](/docs/embedded_components)
- `--config` and `--spec` for [](/docs/jbrowse-img), which draws SVG/PNG with no
  browser in the loop
- what the [Jupyter widget](/docs/jbrowse_jupyter) and [](/docs/jbrowser)
  helpers build for you

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

Save it as `hg38.json` and jbrowse-web opens on it, `jb2export` draws it without
a browser, and a URL carries the same `init` fields as parameters:

```bash
jb2export --config hg38.json --assembly hg38 \
  --loc chr17:43,044,295-43,170,245 --track ncbi_genes --out brca1.png
```

```
?config=hg38.json&assembly=hg38&loc=chr17:43,044,295-43,170,245&tracks=ncbi_genes
```

[](/docs/config_guides/intro) covers the top-level fields,
[](/docs/config_guides/default_session) the session object, and
[](/docs/automating) the `init` block.

Track settings — height, color-by, filters, display mode — are configuration
slots, the same ones the track menu writes, so a view set up by clicking around
exports to JSON and pastes back in as a `defaultSession`.

## The reference is generated from the source

Every configuration type — each adapter, track, display, connection, and
internet account — has a page under [](/docs/config) listing its slots, their
types and their defaults, and every state model has one under [](/docs/models).
Both are generated from the definitions in the source on every build, so they
describe the release you are running.

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

The [](/docs/cookbook) is whole configs short enough to copy, and the
[tutorials](/docs/tutorials) run end to end from public data.

Nearly every figure on this site is rendered from one of these documents, which
is why most carry an "Open this view in JBrowse" link: the image and the live
session come from the same spec.

## See also

- [](/docs/config_guide)
- [](/docs/urlparams)
- [](/docs/automating)
