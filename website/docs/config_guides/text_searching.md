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

Information on generating trix indexes via the CLI can be found
[here](/docs/cli#jbrowse-text-index).

### TrixTextSearchAdapter config

The trix search index is the current file format for name searching.

It is based on the UCSC trix file format described here
https://genome.ucsc.edu/goldenPath/help/trix.html.

To create trix indexes you can use our command line tools. More info can be
found at our [jbrowse text-index guide](/docs/cli#jbrowse-text-index). This tool
will automatically generate a config like this. The config slots are described
below for details:

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

This is more uncommon, but allows back compatibility with a JBrowse1 names index
created by `generate-names.pl`:

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
