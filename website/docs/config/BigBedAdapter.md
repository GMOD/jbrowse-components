---
id: bigbedadapter
title: BigBedAdapter
sidebar_label: Adapter -> BigBedAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `bed` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/bed/src/BigBedAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'FeatureTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BigBedAdapter',
    uri: 'https://example.com/features.bb',
  },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

### Used in

Supplies data to the [FeatureTrack](../featuretrack) track, rendered by:

- [LinearArcDisplay](../lineararcdisplay)
- [LinearBasicDisplay](../linearbasicdisplay)
- [LinearBasicDisplay](../linearbasicdisplay)
- [LinearMultiRowFeatureDisplay](../linearmultirowfeaturedisplay)

### BigBedAdapter - Pre-processor / simplified config

preprocessor to allow minimal config:

```json
{
  "type": "BigBedAdapter",
  "uri": "yourfile.bigBed"
}
```

<details open>
<summary>BigBedAdapter - Slots</summary>

#### slot: bigBedLocation

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/my.bb', locationType: 'UriLocation' }`

#### slot: scoreColumn

The column to use as a "score" attribute

**Type:** `string` · **Default:** `''`

#### slot: aggregateField

An attribute to aggregate features with

**Type:** `string` · **Default:** `'geneName2'`

#### slot: disableGeneHeuristic

Disable the heuristic that auto-detects BED12 features as gene/transcript
structures. Useful for files that have BED12-like structure but are not genes
(e.g. tandem duplications)

**Type:** `boolean` · **Default:** `false`

</details>
