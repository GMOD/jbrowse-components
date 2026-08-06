---
title: The JSON schema
sidebar_label: JSON schema
description:
  One JSON format describes a whole JBrowse session, and every type in it has a
  reference page generated from the source schemas
---

A JBrowse session is a JSON document: which genomes are loaded, which tracks
exist and where their data lives, which views are open, at what locus, with
which display settings. You write or generate that document and open it. There
is no setup API to call and no instance to drive.

The same document is what every surface takes:

- `config.json` served next to jbrowse-web, or a `.jbrowse` file saved by
  jbrowse-desktop
- `?config=` and `&session=` on a JBrowse Web URL, see [](/docs/urlparams)
- the object passed to `createViewState` in the embedded React components, see
  [](/docs/embedded_components)
- `--config` and `--spec` for [](/docs/jbrowse-img), which renders SVG/PNG from
  the command line with no browser in the loop
- the config the [Jupyter widget](/docs/jbrowse_jupyter) and [](/docs/jbrowser)
  helpers build for you

## What is in it

A whole config: the genome, one track, and the view to open on.

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

Save that as `hg38.json` and jbrowse-web opens on it. The same file renders a
PNG with no browser involved:

```bash
jb2export --config hg38.json --assembly hg38 \
  --loc chr17:43,044,295-43,170,245 --track ncbi_genes --out brca1.png
```

and the `init` block is what a URL carries as parameters, so the same view is
also a link:

```
?config=hg38.json&assembly=hg38&loc=chr17:43,044,295-43,170,245&tracks=ncbi_genes
```

[](/docs/config_guides/intro) covers the top-level fields,
[](/docs/config_guides/default_session) the session object, and
[](/docs/automating) the `init` block, whose fields are the same whether they
arrive from a URL, a config file, or an embedded prop.

Track settings — height, color-by, filters, display mode — are configuration
slots, the same ones the track menu writes, so a view set up by clicking around
exports to JSON and pastes back in as a `defaultSession`.

## The reference is generated from the source

Every configuration type — each adapter, track, display, connection, and
internet account — has a page under [](/docs/config) listing its slots, their
types, and their defaults. Every state model has one under [](/docs/models).
Both sets are generated from the `configSchema` and model definitions in the
source and regenerated on every build, so they describe the release you are
running rather than what was true when someone last updated a page by hand.

## Checking a document

```bash
jbrowse validate config.json
```

The [validate command](/docs/cli#jbrowse-validate) checks a config or a saved
`.jbrowse` session against a manifest generated from those same schemas. It is
aimed at the errors JBrowse itself accepts silently: a misspelled slot that
leaves the track loading with the setting doing nothing, a track naming an
assembly that is not defined, a `defaultSession` naming a `trackId` that does
not exist.

## Examples

The [](/docs/cookbook) is whole configs, short enough to copy. The
[tutorials](/docs/tutorials) run end to end from public data to a configured
view.

Nearly every figure on this site is also rendered from one of these documents,
which is why most carry an "Open this view in JBrowse" link — the image and the
live session come from the same spec, so a figure cannot drift from the app it
depicts. [](/docs/automating) describes that pipeline.

## See also

- [](/docs/config_guide)
- [](/docs/urlparams)
- [](/docs/automating)
- [Config reference](/docs/config)
- [State model reference](/docs/models)
