---
id: bedgraphtabixadapter
title: BedGraphTabixAdapter
sidebar_label: Adapter -> BedGraphTabixAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `bed` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/bed/src/BedGraphTabixAdapter/configSchema.ts).

## Example usage

The `uri` shorthand auto-resolves the `.tbi` index:

```js
{
  type: 'QuantitativeTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BedGraphTabixAdapter',
    uri: 'https://example.com/signal.bedGraph.gz',
  },
}
```

_See the **Config slots** section below for all available configuration fields._

used to load bgzip-compressed, tabix-indexed bedGraph signal files

## Related links

- **Track:** [QuantitativeTrack](../quantitativetrack)
- **Display:** [LinearWiggleDisplay](../linearwiggledisplay)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                           | Type                    | Description          |
| ---------------------------------------------- | ----------------------- | -------------------- |
| [bedGraphGzLocation](#slot-bedgraphgzlocation) | `fileLocation`          |                      |
| [index.indexType](#slot-indexindextype)        | `stringEnum` (TBI, CSI) |                      |
| [index.location](#slot-indexlocation)          | `fileLocation`          |                      |
| [columnNames](#slot-columnnames)               | `stringArray`           | List of column names |

<details>
<summary>BedGraphTabixAdapter - Slots</summary>

#### slot: bedGraphGzLocation

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: '/path/to/my.bedgraph', locationType: 'UriLocation' }`

#### slot: index.indexType

**Type:** [`stringEnum`](/docs/config_guides/slot_types#stringenum) (one of
`TBI`, `CSI`) · **Default:** `'TBI'`

#### slot: index.location

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:**
`{ uri: '/path/to/my.bedgraph.gz.tbi', locationType: 'UriLocation' }`

#### slot: columnNames

List of column names

**Type:** `stringArray` · **Default:** `[]`

</details>
