---
id: config_alignments_track
title: Alignments track configuration
---

- minScore - the minimum score to plot in the coverage track. default: 0
- maxScore - the maximum score to plot in the coverage track. default: auto calculated
- scaleType - options: linear, log, to display the coverage data
- adapter - this corresponds to a BamAdapter or CramAdapter or any other
  adapter type that returns alignments-like features

Example AlignmentsTrack config

```json
{
  "trackId": "my_alignments_track",
  "name": "My Alignments",
  "assemblyNames": ["hg19"],
  "type": "AlignmentsTrack",
  "adapter": {
    "type": "BamAdapter",
    "bamLocation": { "uri": "http://yourhost/file.bam" },
    "index": { "location": { "uri": "http://yourhost/file.bam.bai" } }
  }
}
```

### PileupTrack configuration options

Note: an AlignmentsTrack automatically sets up a PileupTrack as a subtrack, so
it is not common to use PileupTrack individually, but it is allowed

- adapter - either gets it's adapter from the parent alignmentstrack or can be
  configured as any adapter that returns alignments-like features
- defaultRendering - options: pileup, svg. default: pileup

Example PileupTrack config

```json
{
  "trackId": "my_pileup_track",
  "name": "My Alignments",
  "assemblyNames": ["hg19"],
  "type": "PileupTrack",
  "adapter": {
    "type": "BamAdapter",
    "bamLocation": { "uri": "http://yourhost/file.bam" },
    "index": { "location": { "uri": "http://yourhost/file.bam.bai" } }
  }
}
```

### SNPCoverageTrack configuration options

Note: an AlignmentsTrack automatically sets up a SNPCoverageTrack as a subtrack,
so it is not common to configure SNPCoverageTrack individually, but it is allowed

- autoscale: local. this is the only currently allowed option
- minScore - the minimum score to plot in the coverage track. default: 0
- maxScore - the maximum score to plot in the coverage track. default: auto calculated
- scaleType - options: linear, log, to display the coverage data
- inverted - boolean option to draw coverage draw upside down. default: false
- adapter - either gets it's adapter from the parent alignmentstrack or can be
  configured as any adapter that returns alignments-like features

Example SNPCoverageTrack config

```json
{
  "trackId": "my_snpcov_track",
  "name": "My Alignments",
  "assemblyNames": ["hg19"],
  "type": "SNPCoverageTrack",
  "adapter": {
    "type": "BamAdapter",
    "bamLocation": { "uri": "http://yourhost/file.bam" },
    "index": { "location": { "uri": "http://yourhost/file.bam.bai" } }
  }
}
```

### BamAdapter configuration options

- bamLocation - a 'file location' for the BAM
- index: a subconfigurations chema containing
  - indexType: options BAI or CSI. default BAI
  - location: the location of the index

Example BamAdapter config

```json
{
  "type": "BamAdapter",
  "bamLocation": { "uri": "http://yourhost/file.bam" },
  "index": { "location": { "uri": "http://yourhost/file.bam.bai" } }
}
```

### CramAdapter configuration options

- cramLocation - a 'file location' for the CRAM
- craiLocation - a 'file location' for the CRAI

Example CramAdapter config

```json
{
  "type": "CramAdapter",
  "cramLocation": { "uri": "http://yourhost/file.cram" },
  "craiLocation": { "uri": "http://yourhost/file.cram.crai" }
}
```
