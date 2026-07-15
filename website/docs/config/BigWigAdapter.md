---
id: bigwigadapter
title: BigWigAdapter
sidebar_label: Adapter -> BigWigAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `wiggle`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/BigWigAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'QuantitativeTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BigWigAdapter',
    uri: 'https://example.com/coverage.bw',
  },
}
```

_See the **Config slots** section below for all available configuration fields._

used to load BigWig quantitative signal files

## Related links

- **Track:** [QuantitativeTrack](../quantitativetrack)
- **Display:** [LinearWiggleDisplay](../linearwiggledisplay)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                   | Type           | Description                                    |
| -------------------------------------- | -------------- | ---------------------------------------------- |
| [bigWigLocation](#slot-bigwiglocation) | `fileLocation` |                                                |
| [source](#slot-source)                 | `string`       | added as feature.get('source') on all features |

<details>
<summary>Advanced slots (1)</summary>

| Slot                                               | Type     | Description                                                                                                                               |
| -------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| [resolutionMultiplier](#slot-resolutionmultiplier) | `number` | Resolution multiplier applied to every fetch: <1 fetches more points (higher resolution), >1 fetches fewer (e.g. 2 = half as many points) |

</details>

<details>
<summary>BigWigAdapter - Slots</summary>

#### slot: bigWigLocation

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: '/path/to/my.bw', locationType: 'UriLocation' }`

#### slot: source

added as feature.get('source') on all features

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:** `''`

#### slot: resolutionMultiplier

Resolution multiplier applied to every fetch: <1 fetches more points (higher
resolution), >1 fetches fewer (e.g. 2 = half as many points)

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `1` ·
_advanced_

</details>
