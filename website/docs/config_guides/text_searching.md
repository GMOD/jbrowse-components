---
id: text_searching
title: Text searching
---

Text searching appears in two forms: "per-track indexes" and "aggregate indexes"
which search across multiple tracks.

Aggregate indexes may look like this:

```json
{
  "aggregateTextSearchAdapters": [
    {
      "type": "TrixTextSearchAdapter",
      "textSearchAdapterId": "hg19-index",
      "ixFilePath": {
        "uri": "https://jbrowse.org/genomes/hg19/trix/hg19.ix",
        "locationType": "UriLocation"
      },
      "ixxFilePath": {
        "uri": "https://jbrowse.org/genomes/hg19/trix/hg19.ixx",
        "locationType": "UriLocation"
      },
      "metaFilePath": {
        "uri": "https://jbrowse.org/genomes/hg19/trix/meta.json",
        "locationType": "UriLocation"
      },
      "assemblyNames": ["hg19"]
    }
  ]
}
```

An example per-track config may look like this:

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
    },
    "indexingAttributes": ["Name", "ID"],
    "indexingFeatureTypesToExclude": ["CDS", "exon"]
  }
}
```

See [jbrowse text-index](/docs/cli#jbrowse-text-index) for generating indexes
via the CLI.

### TrixTextSearchAdapter config

The trix format is based on the
[UCSC trix format](https://genome.ucsc.edu/goldenPath/help/trix.html). Use
[jbrowse text-index](/docs/cli#jbrowse-text-index) to generate indexes and
config automatically. Config slots:

```json
{
  "textSearchAdapter": {
    "type": "TrixTextSearchAdapter",
    "textSearchAdapterId": "gff3tabix_genes-index",
    "ixFilePath": {
      "uri": "trix/gff3tabix_genes.ix"
    },
    "ixxFilePath": {
      "uri": "trix/gff3tabix_genes.ixx"
    },
    "metaFilePath": {
      "uri": "trix/gff3tabix_genes_meta.json"
    }
  }
}
```

- `ixFilePath` - the location of the trix ix file
- `ixxFilePath` - the location of the trix ixx file
- `metaFilePath` - the location of the metadata json file for the trix index

### JBrowse1TextSearchAdapter config

For back-compatibility with a JBrowse1 names index created by
`generate-names.pl`:

```json
{
  "textSearchAdapter": {
    "type": "JBrowse1TextSearchAdapter",
    "textSearchAdapterId": "generate-names-index",
    "namesIndexLocation": {
      "uri": "/names"
    }
  }
}
```

- `namesIndexLocation` - the location of the JBrowse1 names index data directory

## Troubleshooting

### Search returns no results after running text-index

The most common cause is stale 0-byte `.ix`/`.ixx` files from an interrupted
run. Fix with `--force` to overwrite them:

```bash
jbrowse text-index --force
```

If `/tmp` is low on disk space, indexing can fail silently. Use `TMPDIR` to
point elsewhere:

```bash
TMPDIR=~/alt_tmp_dir jbrowse text-index
```

### Only some genes are searchable

`text-index` indexes `Name` and `ID` attributes by default. Add others with
`--attributes`:

```bash
jbrowse text-index --attributes=Name,ID,gene_name
```
