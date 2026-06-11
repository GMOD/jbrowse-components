---
title: Alignments track configuration
description: BAM/CRAM track config with BamAdapter and CramAdapter options
guide_category: Track types
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

A reduced form is also accepted: when only `uri` is given, the adapter assumes
the index is at `yourfile.bam.bai` (the data URI with `.bai` appended). See the
[BamAdapter config docs](/docs/config/bamadapter) for all options.

```json
{ "type": "BamAdapter", "uri": "http://yourhost/file.bam" }
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

A reduced form is also accepted: when only `uri` is given, the adapter assumes
the index is at `yourfile.cram.crai` (the data URI with `.crai` appended). See
the [CramAdapter config docs](/docs/config/cramadapter) for all options.

```json
{ "type": "CramAdapter", "uri": "http://yourhost/file.cram" }
```

#### Display options

Display settings — `colorBy`, `height`, `featureHeight`, `filterBy`, and the
coverage `autoscale`/`minScore`/`maxScore` — are slots on the
`LinearAlignmentsDisplay`, not on the track. Reads are grey by default
(`colorBy` is `{ "type": "normal" }`). To change a default, nest a display entry
in the track's `displays` array:

```json
{
  "type": "AlignmentsTrack",
  "trackId": "my_alignments_track",
  "name": "My Alignments",
  "assemblyNames": ["hg19"],
  "adapter": { "type": "BamAdapter", "uri": "http://yourhost/file.bam" },
  "displays": { "colorBy": { "type": "pairOrientation" }, "height": 250 }
}
```

The `displays` object is shorthand — JBrowse applies each setting for you, so
you don't have to know the display's name (`LinearAlignmentsDisplay`) or write
the array. Use the array form when you need per-display control (see the
[track config guide](/docs/config_guides/tracks/#configuring-displays)).

See the
[LinearAlignmentsDisplay config docs](/docs/config/linearalignmentsdisplay) for
the full list of slots. To open a track in a particular state from a link or
embedded view instead of changing the default, see
[applying display settings](/docs/tutorials/display_settings).
