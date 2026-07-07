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

### BigBedAdapter - Pre-processor / simplified config

preprocessor to allow minimal config:

```json
{
  "type": "BigBedAdapter",
  "uri": "yourfile.bigBed"
}
```

| Slot                                               | Type           | Description                                                                                                                                                                        |
| -------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [bigBedLocation](#slot-bigbedlocation)             | `fileLocation` |                                                                                                                                                                                    |
| [scoreColumn](#slot-scorecolumn)                   | `string`       | The column to use as a "score" attribute                                                                                                                                           |
| [aggregateField](#slot-aggregatefield)             | `string`       | An attribute to aggregate features with                                                                                                                                            |
| [disableGeneHeuristic](#slot-disablegeneheuristic) | `boolean`      | Disable the heuristic that auto-detects BED12 features as gene/transcript structures. Useful for files that have BED12-like structure but are not genes (e.g. tandem duplications) |

<details>
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

## Related links

- **Track:** [FeatureTrack](../featuretrack)
- **Display:** [LinearArcDisplay](../lineararcdisplay)
- **Display:** [LinearBasicDisplay](../linearbasicdisplay)
- **Display:** [LinearBasicDisplay](../linearbasicdisplay)
- **Display:** [LinearMultiRowFeatureDisplay](../linearmultirowfeaturedisplay)
