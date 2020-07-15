---
id: config_wiggle_track
title: Wiggle track configuration
---

- minScore - the minimum score to plot in the coverage track. default: 0
- maxScore - the maximum score to plot in the coverage track. default: auto calculated
- scaleType - options: linear, log, to display the coverage data
- adapter - this corresponds to a BamAdapter or CramAdapter or any other
  adapter type that returns alignments-like features

Example WiggleTrack config

```json
{
  "trackId": "my_wiggle_track",
  "name": "My Wiggle Track",
  "assemblyNames": ["hg19"],
  "type": "WiggleTrack",
  "adapter": {
    "type": "BigWig",
    "bigWigLocation": { "uri": "http://yourhost/file.bw" }
  }
}
```

### BigWig adapter configuration options

- bigWigLocation - a 'file location' for the bigwig

Example BigWig adapter config

```json
{
  "type": "BigWig",
  "bigWigLocation": { "uri": "http://yourhost/file.bw" }
}
```
