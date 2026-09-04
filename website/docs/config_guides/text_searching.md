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

An aggregate index. `uri` points at the `.ix` that `jbrowse text-index` wrote,
and the `.ixx` and `_meta.json` beside it derive from that name:

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

A per-track index, with the two slots that decide what `text-index` puts in it:

```json addtrack
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

[`indexingAttributes`](/docs/config/basetrack/#slot-textsearchingindexingattributes)
and
[`indexingFeatureTypesToExclude`](/docs/config/basetrack/#slot-textsearchingindexingfeaturetypestoexclude)
are the per-track form of `--attributes` and `--exclude`.

## Indexable formats

`text-index` reads GFF3, GTF and VCF tracks and skips every other adapter type;
[the CLI page](/docs/cli#jbrowse-text-index) lists the adapters. Two formats
differ from GFF3:

- **VCF** indexes the variant IDs plus any INFO fields named in `--attributes`.
- **GTF** has no gene or transcript rows, only exon/CDS/UTR rows repeating a
  `gene_id`, so `text-index` groups rows by `gene_id` and `transcript_id` and
  indexes each gene or transcript once. `indexingFeatureTypesToExclude` does not
  apply to GTF, since dropping rows would only truncate those spans.

## TrixTextSearchAdapter config

`text-index` writes three files, and the adapter reads two of them: the `uri`
shorthand names `ixFilePath` (the `.ix` the search box reads) and derives
`ixxFilePath` (`uri` plus an `x`, the prefix index). Set the two
[slots](/docs/config/trixtextsearchadapter) individually when the files do not
sit together under those names. The third file, `<name>_meta.json`, records what
the index was built from for whoever built it; nothing in JBrowse reads it, so
no slot points at it.

A names index from JBrowse 1's `generate-names.pl` still works through
[`JBrowse1TextSearchAdapter`](/docs/config/jbrowse1textsearchadapter), with
`namesIndexLocation` pointing at the names directory. To build your own adapter,
see
[creating a text search adapter](/docs/developer_guides/creating_text_search_adapter).

## Troubleshooting

- **No results after running text-index.** Usually stale 0-byte `.ix`/`.ixx`
  files from an interrupted run; `jbrowse text-index --force` overwrites them.
- **Out of disk space while indexing.** `text-index` writes temporary data to
  `/tmp`; `TMPDIR=~/alt_tmp_dir jbrowse text-index` moves it.
- **Only some genes are searchable.** The default attributes are `Name`, `ID`
  and `symbol`; add others with `--attributes=Name,ID,symbol,gene_name`, and
  check that the feature type carrying the name is not in
  [`--exclude`](/docs/cli#jbrowse-text-index).

## The trix index format

`jbrowse text-index` re-implements the
[UCSC trix format](https://genome.ucsc.edu/goldenPath/help/trix.html) so no UCSC
tools are needed. Given input like:

```
GENEID001  Wnt signalling
GENEID002  ey  Pax6
```

it writes an `.ix` file sorted alphabetically by word:

```
ey  GENEID002
Pax6  GENEID002
signalling  GENEID001
Wnt  GENEID001
```

and an `.ixx` file recording the byte offset of each prefix (`signa000000435`).
JBrowse extends the format: each `.ix` line also carries the feature's name and
genomic location in an encoded form.

## See also

- [Basic usage: the location search box](/docs/user_guides/basic_usage#using-the-location-search-box)
- [](/docs/user_guides/connections)
