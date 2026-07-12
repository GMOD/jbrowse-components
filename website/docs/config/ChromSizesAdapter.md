---
id: chromsizesadapter
title: ChromSizesAdapter
sidebar_label: Adapter -> ChromSizesAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `sequence`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sequence/src/ChromSizesAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'ReferenceSequenceTrack',
  trackId: 'my_assembly-ReferenceSequenceTrack',
  adapter: {
    type: 'ChromSizesAdapter',
    uri: 'https://example.com/species.chrom.sizes',
  },
}
```

_See the **Config slots** section below for all available configuration fields._

loads only chromosome names and lengths from a UCSC-style `.chrom.sizes` file
(tab-separated `name<TAB>length`), with no actual sequence. Useful for karyotype
or whole-genome/synteny views where the base-level sequence isn't needed.

## Related links

- **Track:** [ReferenceSequenceTrack](../referencesequencetrack)
- **Display:**
  [LinearReferenceSequenceDisplay](../linearreferencesequencedisplay)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                           | Type           | Description |
| ---------------------------------------------- | -------------- | ----------- |
| [chromSizesLocation](#slot-chromsizeslocation) | `fileLocation` |             |

<details>
<summary>ChromSizesAdapter - Slots</summary>

#### slot: chromSizesLocation

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:**
`{ uri: '/path/to/species.chrom.sizes', locationType: 'UriLocation' }`

</details>
