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

_See the **Config slots** section below for all available configuration fields._

## Related links

- **Track:** [FeatureTrack](../featuretrack)
- **Display:** [LinearArcDisplay](../lineararcdisplay)
- **Display:** [LinearBasicDisplay](../linearbasicdisplay)
- **Display:** [LinearBasicDisplay](../linearbasicdisplay)
- **Display:** [LinearMultiRowFeatureDisplay](../linearmultirowfeaturedisplay)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                               | Type           | Description                                                                           |
| -------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------- |
| [bigBedLocation](#slot-bigbedlocation)             | `fileLocation` |                                                                                       |
| [scoreColumn](#slot-scorecolumn)                   | `string`       | The column to use as a "score" attribute                                              |
| [aggregateField](#slot-aggregatefield)             | `string`       | An attribute to aggregate features with                                               |
| [disableGeneHeuristic](#slot-disablegeneheuristic) | `boolean`      | Disable the heuristic that auto-detects BED12 features as gene/transcript structures. |

<details>
<summary>BigBedAdapter - Slots</summary>

#### slot: bigBedLocation

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: '/path/to/my.bb', locationType: 'UriLocation' }`

#### slot: scoreColumn

The column to use as a "score" attribute

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:** `''`

#### slot: aggregateField

An attribute to aggregate features with

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:**
`'geneName2'`

#### slot: disableGeneHeuristic

Disable the heuristic that auto-detects BED12 features as gene/transcript
structures. Useful for files that have BED12-like structure but are not genes
(e.g. tandem duplications)

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`false`

</details>
