---
title: Text searching
description: Per-track and aggregate full-text search indexes
guide_category: Core configuration
---

**TL;DR:** text searching comes in two forms, both built with
[`jbrowse text-index`](/docs/cli#jbrowse-text-index). An **aggregate index**
(top-level `aggregateTextSearchAdapters`) is searched across many tracks at
once, for a genome-wide gene-name index. A **per-track index** (a track's
`textSearching` slot) makes just one track searchable.

An aggregate index looks like this. `uri` points at the `.ix` that
`jbrowse text-index` wrote, and the `.ixx` and `_meta.json` beside it are
derived from that name:

```json
{
  "aggregateTextSearchAdapters": [
    {
      "type": "TrixTextSearchAdapter",
      "uri": "trix/hg19.ix",
      "assemblyNames": ["hg19"]
    }
  ]
}
```

A per-track config looks like this:

```json
{
  "type": "FeatureTrack",
  "trackId": "mytrack",
  "name": "My track name",
  "assemblyNames": ["hg19"],
  "adapter": {
    "type": "Gff3TabixAdapter",
    "uri": "yourfile.gff.gz"
  },
  "textSearching": {
    "textSearchAdapter": {
      "type": "TrixTextSearchAdapter",
      "uri": "trix/mytrack.ix",
      "assemblyNames": ["hg19"]
    },
    "indexingAttributes": ["Name", "ID"],
    "indexingFeatureTypesToExclude": ["CDS", "exon"]
  }
}
```

The `textSearching` slots control what gets indexed when you run
`jbrowse text-index` against this track:

- [`indexingAttributes`](/docs/config/basetrack/#slot-textsearchingindexingattributes),
  feature attributes to index
- [`indexingFeatureTypesToExclude`](/docs/config/basetrack/#slot-textsearchingindexingfeaturetypestoexclude),
  feature types to skip (e.g. `CDS`, `exon`), so the index holds only the
  genes/transcripts users search for

## Indexable formats

`text-index` reads GFF3 (`Gff3Adapter`, `Gff3TabixAdapter`), GTF (`GtfAdapter`)
and VCF (`VcfAdapter`, `VcfTabixAdapter`) tracks. Tracks with any other adapter
type are skipped.

For VCF, the variant IDs are indexed along with any INFO fields named in
`--attributes`.

GTF has no gene or transcript rows: a gene exists only as its exon/CDS/UTR rows
repeating a `gene_id`. Rows are therefore grouped by `gene_id` and
`transcript_id`, and each gene or transcript is indexed once, spanning all of
its rows. `indexingFeatureTypesToExclude` does not apply to GTF, since dropping
rows would only truncate those spans. GTF also has no `Name`/`ID` attributes, so
the defaults additionally match their GTF spellings (`gene_name`,
`transcript_name`, `gene_id`, `transcript_id`).

See [jbrowse text-index](/docs/cli#jbrowse-text-index) for generating indexes
via the CLI. See the
[Gff3TabixAdapter config docs](/docs/config/gff3tabixadapter) for adapter
options including CSI index support and `dontRedispatch`.

## TrixTextSearchAdapter config

The trix format is based on the
[UCSC trix format](https://genome.ucsc.edu/goldenPath/help/trix.html). Use
[jbrowse text-index](/docs/cli#jbrowse-text-index) to generate the index files
and config automatically. The adapter reads three files, and the `uri` shorthand
above names the first and derives the other two:

- `ixFilePath` - the trix `.ix` file, the one `uri` points at
- `ixxFilePath` - the trix `.ixx` file, `uri` plus an `x`
- `metaFilePath` - the metadata JSON, `uri` with `.ix` replaced by `_meta.json`

Set the three slots individually when the files do not sit together under those
names.

See the [TrixTextSearchAdapter config docs](/docs/config/trixtextsearchadapter)
for all options.

## JBrowse1TextSearchAdapter config

A names index created by JBrowse 1's `generate-names.pl` can still be used via
the `JBrowse1TextSearchAdapter`. Point `namesIndexLocation` at the names
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
directory. See
[Why am I running out of disk space while trix is running](/docs/faq#why-am-i-running-out-of-disk-space-while-trix-is-running)
in the FAQ.

### Only some genes are searchable

`text-index` indexes `Name`, `ID`, and `symbol` attributes by default. Add
others with `--attributes`:

```bash
jbrowse text-index --attributes=Name,ID,symbol,gene_name
```

Also check that the feature type carrying the name is not in
[`--exclude`](/docs/cli#jbrowse-text-index).

## See also

- [Basic usage: the location search box](/docs/user_guides/basic_usage#using-the-location-search-box)
- [](/docs/user_guides/connections)
