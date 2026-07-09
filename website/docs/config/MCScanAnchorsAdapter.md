---
id: mcscananchorsadapter
title: MCScanAnchorsAdapter
sidebar_label: Adapter -> MCScanAnchorsAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the
`comparative-adapters` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/MCScanAnchorsAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'SyntenyTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg19', 'hg38'],
  adapter: {
    type: 'MCScanAnchorsAdapter',
    uri: 'https://example.com/data.anchors',
    bed1: 'https://example.com/query.bed',
    bed2: 'https://example.com/target.bed',
    assemblyNames: ['hg19', 'hg38'],
  },
}
```

_See the **Config slots** section below for all available configuration fields._

used to load MCScan (jcvi) `.anchors` files with their two BED files

## Related links

- **Track:** [SyntenyTrack](../syntenytrack)
- **Display:** [DotplotDisplay](../dotplotdisplay)
- **Display:** [LGVSyntenyDisplay](../lgvsyntenydisplay)
- **Display:** [LinearSyntenyDisplay](../linearsyntenydisplay)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                                 | Type           | Description |
| ---------------------------------------------------- | -------------- | ----------- |
| [mcscanAnchorsLocation](#slot-mcscananchorslocation) | `fileLocation` |             |
| [bed1Location](#slot-bed1location)                   | `fileLocation` |             |
| [bed2Location](#slot-bed2location)                   | `fileLocation` |             |
| [assemblyNames](#slot-assemblynames)                 | `stringArray`  |             |

<details>
<summary>MCScanAnchorsAdapter - Slots</summary>

#### slot: mcscanAnchorsLocation

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: '/path/to/mcscan.anchors', locationType: 'UriLocation' }`

#### slot: bed1Location

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: '/path/to/file.bed', locationType: 'UriLocation' }`

#### slot: bed2Location

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: '/path/to/file.bed', locationType: 'UriLocation' }`

#### slot: assemblyNames

**Type:** `stringArray` · **Default:** `[]`

</details>
