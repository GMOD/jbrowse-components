---
id: cramadapter
title: CramAdapter
sidebar_label: Adapter -> CramAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `alignments`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/CramAdapter/configSchema.ts).

## Example usage

The `uri` shorthand auto-resolves the `.crai` index:

```js
{
  type: 'AlignmentsTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'CramAdapter',
    uri: 'https://example.com/sample.cram',
  },
}
```

_See the **Config slots** section below for all available configuration fields._

used to configure CRAM adapter

Note: `sequenceAdapter` does **not** need to be specified manually — JBrowse
automatically supplies it from the enclosing assembly's sequence track.

## Related links

- **Track:** [AlignmentsTrack](../alignmentstrack)
- **Display:** [LinearAlignmentsDisplay](../linearalignmentsdisplay)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                               | Type           | Description |
| ---------------------------------- | -------------- | ----------- |
| [cramLocation](#slot-cramlocation) | `fileLocation` |             |
| [craiLocation](#slot-crailocation) | `fileLocation` |             |

<details>
<summary>Advanced slots (1)</summary>

| Slot                                   | Type     | Description                                                                                  |
| -------------------------------------- | -------- | -------------------------------------------------------------------------------------------- |
| [fetchSizeLimit](#slot-fetchsizelimit) | `number` | size in bytes over which to display a warning to the user that too much data will be fetched |

</details>

<details>
<summary>CramAdapter - Slots</summary>

#### slot: fetchSizeLimit

size in bytes over which to display a warning to the user that too much data
will be fetched

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:**
`3_000_000` · _advanced_

#### slot: cramLocation

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: '/path/to/my.cram', locationType: 'UriLocation' }`

#### slot: craiLocation

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: '/path/to/my.cram.crai', locationType: 'UriLocation' }`

</details>
