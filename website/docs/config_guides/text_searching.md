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

The `textSearching` slots control what gets indexed when you run
`jbrowse text-index` against this track:

- [`indexingAttributes`](/docs/config/basetrack/#slot-textsearchingindexingattributes),
  feature attributes to index
- [`indexingFeatureTypesToExclude`](/docs/config/basetrack/#slot-textsearchingindexingfeaturetypestoexclude),
  feature types to skip (e.g. `CDS`, `exon`), so the index holds only the
  genes/transcripts users search for

## Indexable formats

`text-index` reads GFF3 (`Gff3Adapter`, `Gff3TabixAdapter`), GTF (`GtfAdapter`)
and VCF (`VcfAdapter`, `VcfTabixAdapter`) tracks; other adapters are skipped.
For VCF, variant IDs are indexed along with any INFO fields named in
`--attributes`.

GTF has no gene or transcript rows, so rows are grouped by `gene_id` and
`transcript_id` and each gene or transcript is indexed once across its rows.
`indexingFeatureTypesToExclude` does not apply to GTF. The default attributes
also match the GTF spellings (`gene_name`, `transcript_name`, `gene_id`,
`transcript_id`).

See [jbrowse text-index](/docs/cli#jbrowse-text-index) and the
[Gff3TabixAdapter config docs](/docs/config/gff3tabixadapter).

## TrixTextSearchAdapter config

`text-index` writes three files, and the `uri` shorthand names the first and
derives the other two:

- `ixFilePath` - the trix `.ix` file the search box reads
- `ixxFilePath` - the `.ixx` prefix index, `uri` plus an `x`
- `metaFilePath` - `uri` with `.ix` replaced by `_meta.json`, recording what the
  index was built from

Set the three slots individually when the files do not sit together under those
names.

See the [TrixTextSearchAdapter config docs](/docs/config/trixtextsearchadapter)
for all options.

## JBrowse1TextSearchAdapter config

A names index from JBrowse 1's `generate-names.pl` works through
`JBrowse1TextSearchAdapter` with `namesIndexLocation` pointing at the names
directory. See the
[JBrowse1TextSearchAdapter config docs](/docs/config/jbrowse1textsearchadapter),
and
[creating a text search adapter](/docs/developer_guides/creating_text_search_adapter)
for a custom one.

## Troubleshooting

### Search returns no results after running text-index

Usually stale 0-byte `.ix`/`.ixx` files from an interrupted run. Overwrite them:

```bash
jbrowse text-index --force
```

### Running out of disk space while indexing

`jbrowse text-index` writes temporary data to `/tmp`. Override the directory:

```bash
TMPDIR=~/alt_tmp_dir jbrowse text-index
```

### Only some genes are searchable

`text-index` indexes `Name`, `ID`, and `symbol` attributes by default. Add
others with `--attributes`:

```bash
jbrowse text-index --attributes=Name,ID,symbol,gene_name
```

Also check that the feature type carrying the name is not in
[`--exclude`](/docs/cli#jbrowse-text-index).

## The trix index format

The format follows the
[UCSC trix spec](https://genome.ucsc.edu/goldenPath/help/trix.html),
re-implemented in the JBrowse CLI so no UCSC tools are needed. Given input like:

```
GENEID001  Wnt signalling
GENEID002  ey  Pax6
```

It generates an `.ix` file, sorted alphabetically:

```
ey  GENEID002
Pax6  GENEID002
signalling  GENEID001
Wnt  GENEID001
```

A second file, `.ixx`, records the byte offset of each line, e.g.:

```
signa000000435
```

JBrowse extends the format: the `.ix` file also encodes each feature's name and
genomic location.

## See also

- [Basic usage: the location search box](/docs/user_guides/basic_usage#using-the-location-search-box)
- [](/docs/user_guides/connections)
