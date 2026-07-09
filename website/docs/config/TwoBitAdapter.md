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

_See the **Config slots** section below for all available configuration fields._

## Related links

- **Track:** [ReferenceSequenceTrack](../referencesequencetrack)
- **Display:** [LinearGCContentDisplay](../lineargccontentdisplay)
- **Display:**
  [LinearReferenceSequenceDisplay](../linearreferencesequencedisplay)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                           | Type           | Description                                                                                                  |
| ---------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------ |
| [twoBitLocation](#slot-twobitlocation)         | `fileLocation` |                                                                                                              |
| [chromSizesLocation](#slot-chromsizeslocation) | `fileLocation` | An optional chrom.sizes file can be supplied to speed up loading since parsing the twobit file can take time |

<details>
<summary>TwoBitAdapter - Slots</summary>

#### slot: twoBitLocation

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: '/path/to/my.2bit', locationType: 'UriLocation' }`

#### slot: chromSizesLocation

An optional chrom.sizes file can be supplied to speed up loading since parsing
the twobit file can take time

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:**
`{ uri: '/path/to/default.chrom.sizes', locationType: 'UriLocation' }`

</details>
