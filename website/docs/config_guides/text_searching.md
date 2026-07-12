---
title: Text searching
description: Per-track and aggregate full-text search indexes
guide_category: Other features
---

Text searching comes in two forms. An **aggregate index** lives in the top-level
`aggregateTextSearchAdapters` array and is searched across many tracks at once.
Use it for a genome-wide gene-name index shared by every track on an assembly. A
**per-track index** attaches to a single track's `textSearching` slot. Use it to
make just one track searchable.

An aggregate index looks like this:

```json
{
  "aggregateTextSearchAdapters": [
    {
      "type": "TrixTextSearchAdapter",
      "textSearchAdapterId": "hg19-index",
      "ixFilePath": {
        "uri": "https://jbrowse.org/genomes/hg19/trix/hg19.ix"
      },
      "ixxFilePath": {
        "uri": "https://jbrowse.org/genomes/hg19/trix/hg19.ixx"
      },
      "metaFilePath": {
        "uri": "https://jbrowse.org/genomes/hg19/trix/meta.json"
      },
      "assemblyNames": ["hg19"]
    }
  ]
}
```

A per-track config looks like this:

```json
{
  "trackId": "mytrack",
  "name": "My track name",
  "adapter": {
    "type": "Gff3TabixAdapter",
    "gffGzLocation": { "uri": "yourfile.gff.gz" },
    "index": { "location": { "uri": "yourfile.gff.gz.tbi" } }
  },
  "textSearching": {
    "textSearchAdapter": {
      "type": "TrixTextSearchAdapter",
      "textSearchAdapterId": "mytrack-index",
      "ixFilePath": { "uri": "trix/mytrack.ix" },
      "ixxFilePath": { "uri": "trix/mytrack.ixx" },
      "metaFilePath": { "uri": "trix/mytrack_meta.json" },
      "assemblyNames": ["hg19"]
    },
    "indexingAttributes": ["Name", "ID"],
    "indexingFeatureTypesToExclude": ["CDS", "exon"]
  }
}
```

The `textSearching` slots control what gets indexed when you run
`jbrowse text-index` against this track:

- [`indexingAttributes`](/docs/config/basetrack/#slot-textsearchingindexingattributes)
  — feature attributes to index
- [`indexingFeatureTypesToExclude`](/docs/config/basetrack/#slot-textsearchingindexingfeaturetypestoexclude)
  — feature types to skip (e.g. `CDS`, `exon`), so the index holds only the
  genes/transcripts users search for

See [jbrowse text-index](/docs/cli#jbrowse-text-index) for generating indexes
via the CLI. See the
[Gff3TabixAdapter config docs](/docs/config/gff3tabixadapter) for adapter
options including CSI index support and `dontRedispatch`.

## TrixTextSearchAdapter config

The trix format is based on the
[UCSC trix format](https://genome.ucsc.edu/goldenPath/help/trix.html). Use
[jbrowse text-index](/docs/cli#jbrowse-text-index) to generate the index files
and config automatically. The adapter (shown in the examples above) points at
three files:

- `ixFilePath` - the trix `.ix` file
- `ixxFilePath` - the trix `.ixx` file
- `metaFilePath` - the metadata JSON file for the index

See the [TrixTextSearchAdapter config docs](/docs/config/trixtextsearchadapter)
for all options.

## JBrowse1TextSearchAdapter config

A names index created by JBrowse 1's `generate-names.pl` can still be used via
the `JBrowse1TextSearchAdapter` — point `namesIndexLocation` at the names
directory. See the
[JBrowse1TextSearchAdapter config docs](/docs/config/jbrowse1textsearchadapter)
for the config slots. To build a custom text-search adapter, see
[creating a text search adapter](/docs/developer_guides/creating_text_search_adapter).

## Troubleshooting

### Search returns no results after running text-index

The most common cause is stale 0-byte `.ix`/`.ixx` files from an interrupted
run. Fix with `--force` to overwrite them:

```bash
jbrowse text-index --force
```

If indexing fails because `/tmp` is low on disk space, override the temp
directory — see
[Why am I running out of disk space while trix is running](/docs/faq#why-am-i-running-out-of-disk-space-while-trix-is-running)
in the FAQ.

### Only some genes are searchable

`text-index` indexes `Name`, `ID`, and `symbol` attributes by default. Add
others with `--attributes`:

```bash
jbrowse text-index --attributes=Name,ID,symbol,gene_name
```

## See also

- [Basic usage: the location search box](/docs/user_guides/basic_usage#using-the-location-search-box)
  — searching for gene names and regions once an index is built
- [Connections](/docs/user_guides/connections) — loading track hubs that ship
  their own indexes
