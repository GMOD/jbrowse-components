---
id: twobitadapter
title: TwoBitAdapter
sidebar_label: Adapter -> TwoBitAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `sequence`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sequence/src/TwoBitAdapter/configSchema.ts).

## Example usage

A `.2bit` file is self-contained; add `chromSizes` to skip an initial full-file
scan on genomes with many contigs:

```js
{
  type: 'ReferenceSequenceTrack',
  trackId: 'my_assembly-ReferenceSequenceTrack',
  adapter: {
    type: 'TwoBitAdapter',
    uri: 'https://example.com/genome.2bit',
  },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

### Used in

Supplies data to the [ReferenceSequenceTrack](../referencesequencetrack) track,
rendered by:

- [LinearGCContentDisplay](../lineargccontentdisplay)
- [LinearReferenceSequenceDisplay](../linearreferencesequencedisplay)

### TwoBitAdapter - Pre-processor / simplified config

preprocessor to allow minimal config (note that adding chromSizes improves
speed, otherwise has to read a lot of the twobit file to calculate chromosome
names and sizes):

```json
{
  "type": "TwoBitAdapter",
  "uri": "yourfile.2bit"
  "chromSizes":"yourfile.chrom.sizes"
}

```

<details open>
<summary>TwoBitAdapter - Slots</summary>

#### slot: twoBitLocation

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/my.2bit', locationType: 'UriLocation' }`

#### slot: chromSizesLocation

An optional chrom.sizes file can be supplied to speed up loading since parsing
the twobit file can take time

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/default.chrom.sizes', locationType: 'UriLocation' }`

</details>
