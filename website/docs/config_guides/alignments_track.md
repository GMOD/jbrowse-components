---
id: alignments_track
title: Alignments track configuration
---

Example `AlignmentsTrack` config:

```json
{
  "trackId": "my_alignments_track",
  "name": "My Alignments",
  "assemblyNames": ["hg19"],
  "type": "AlignmentsTrack",
  "adapter": {
    "type": "BamAdapter",
    "bamLocation": {
      "uri": "http://yourhost/file.bam"
    },
    "index": {
      "location": {
        "uri": "http://yourhost/file.bam.bai"
      }
    }
  }
}
```

#### BamAdapter configuration options

- `bamLocation` - a 'file location' for the BAM
- `index` - a subconfiguration schema containing
  - indexType: options BAI or CSI. default: BAI
  - location: a 'file location' of the index

Example `BamAdapter` config:

```json
{
  "type": "BamAdapter",
  "bamLocation": {
    "uri": "http://yourhost/file.bam"
  },
  "index": {
    "location": {
      "uri": "http://yourhost/file.bam.bai"
    }
  }
}
```

#### CramAdapter configuration options

- `cramLocation` - a 'file location' for the CRAM
- `craiLocation` - a 'file location' for the CRAI
- `sequenceAdapter` - a subadapter describing the location of the reference
  assembly (_e.g._ an
  [IndexedFastaAdapter](/docs/config_guides/assemblies/#indexedfastaadapter))

Example `CramAdapter` config:

```json
{
  "type": "CramAdapter",
  "cramLocation": {
    "uri": "http://yourhost/file.cram"
  },
  "craiLocation": {
    "uri": "http://yourhost/file.cram.crai"
  },
  "sequenceAdapter": {
    "type": "IndexedFastaAdapter",
    "fastaLocation": {
      "uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.fa",
      "locationType": "UriLocation"
    },
    "faiLocation": {
      "uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.fa.fai",
      "locationType": "UriLocation"
    }
  }
}
```
