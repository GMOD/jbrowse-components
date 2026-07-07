---
id: htsgetbamadapter
title: HtsgetBamAdapter
sidebar_label: Adapter -> HtsgetBamAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `alignments`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/HtsgetBamAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'AlignmentsTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'HtsgetBamAdapter',
    htsgetBase: 'https://htsget.example.com/reads/',
    htsgetTrackId: 'NA12878',
  },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

Used to fetch data from Htsget endpoints in BAM format, using the gmod/bam
library

| Slot                                 | Type     | Description                                    |
| ------------------------------------ | -------- | ---------------------------------------------- |
| [htsgetBase](#slot-htsgetbase)       | `string` | the base URL to fetch from                     |
| [htsgetTrackId](#slot-htsgettrackid) | `string` | the trackId, which is appended to the base URL |

<details>
<summary>HtsgetBamAdapter - Slots</summary>

#### slot: htsgetBase

the base URL to fetch from

**Type:** `string` · **Default:** `''`

#### slot: htsgetTrackId

the trackId, which is appended to the base URL

**Type:** `string` · **Default:** `''`

</details>

## Related links

- **Track:** [AlignmentsTrack](../alignmentstrack)
- **Display:** [LinearAlignmentsDisplay](../linearalignmentsdisplay)
