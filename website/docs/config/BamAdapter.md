---
id: bamadapter
title: BamAdapter
sidebar_label: Adapter -> BamAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `alignments`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/BamAdapter/configSchema.ts).

## Example usage

The `uri` shorthand auto-resolves the `.bai` index. For a `.csi` index or a
differently-named index, set `index` explicitly with the full slot form:

```js
{
  type: 'AlignmentsTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BamAdapter',
    uri: 'https://example.com/sample.bam',
  },
}
```

_See the **Config slots** section below for all available configuration fields._

used to configure BAM adapter

Note: `sequenceAdapter` does **not** need to be specified manually — JBrowse
automatically supplies it from the enclosing assembly's sequence track.

## Related links

- **Track:** [AlignmentsTrack](../alignmentstrack)
- **Display:** [LinearAlignmentsDisplay](../linearalignmentsdisplay)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                    | Type                    | Description |
| --------------------------------------- | ----------------------- | ----------- |
| [bamLocation](#slot-bamlocation)        | `fileLocation`          |             |
| [index.indexType](#slot-indexindextype) | `stringEnum` (BAI, CSI) |             |
| [index.location](#slot-indexlocation)   | `fileLocation`          |             |

<details>
<summary>Advanced slots (1)</summary>

| Slot                                   | Type     | Description                                                                                           |
| -------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| [fetchSizeLimit](#slot-fetchsizelimit) | `number` | size to fetch in bytes over which to display a warning to the user that too much data will be fetched |

</details>

<details>
<summary>BamAdapter - Slots</summary>

#### slot: bamLocation

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: '/path/to/my.bam', locationType: 'UriLocation' }`

#### slot: index.indexType

**Type:** [`stringEnum`](/docs/config_guides/slot_types#stringenum) (one of
`BAI`, `CSI`) · **Default:** `'BAI'`

#### slot: index.location

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: '/path/to/my.bam.bai', locationType: 'UriLocation' }`

#### slot: fetchSizeLimit

size to fetch in bytes over which to display a warning to the user that too much
data will be fetched

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:**
`5_000_000` · _advanced_

</details>
