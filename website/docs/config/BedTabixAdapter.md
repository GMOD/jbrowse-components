---
id: bedtabixadapter
title: BedTabixAdapter
sidebar_label: Adapter -> BedTabixAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `bed` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/bed/src/BedTabixAdapter/configSchema.ts).

## Example usage

The `uri` shorthand auto-resolves the `.tbi` index; add `csi: true` for a `.csi`
index instead:

```js
{
  type: 'FeatureTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BedTabixAdapter',
    uri: 'https://example.com/features.bed.gz',
  },
}
```

_See the **Config slots** section below for all available configuration fields._

## Related links

- **Track:** [FeatureTrack](../featuretrack)
- **Display:** [LinearScoreDisplay](../linearscoredisplay)
- **Display:** [LinearArcDisplay](../lineararcdisplay)
- **Display:** [LinearBasicDisplay](../linearbasicdisplay)
- **Display:** [LinearMultiRowFeatureDisplay](../linearmultirowfeaturedisplay)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                               | Type                    | Description                                                                           |
| -------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------- |
| [bedGzLocation](#slot-bedgzlocation)               | `fileLocation`          |                                                                                       |
| [index.indexType](#slot-indexindextype)            | `stringEnum` (TBI, CSI) |                                                                                       |
| [index.location](#slot-indexlocation)              | `fileLocation`          |                                                                                       |
| [columnNames](#slot-columnnames)                   | `stringArray`           | List of column names                                                                  |
| [scoreColumn](#slot-scorecolumn)                   | `string`                | The column to use as a "score" attribute                                              |
| [autoSql](#slot-autosql)                           | `string`                | The autoSql definition for the data fields in the file                                |
| [disableGeneHeuristic](#slot-disablegeneheuristic) | `boolean`               | Disable the heuristic that auto-detects BED12 features as gene/transcript structures. |

<details>
<summary>BedTabixAdapter - Slots</summary>

#### slot: bedGzLocation

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: '/path/to/my.bed.gz', locationType: 'UriLocation' }`

#### slot: index.indexType

**Type:** [`stringEnum`](/docs/config_guides/slot_types#stringenum) (one of
`TBI`, `CSI`) · **Default:** `'TBI'`

#### slot: index.location

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: '/path/to/my.bed.gz.tbi', locationType: 'UriLocation' }`

#### slot: columnNames

List of column names

**Type:** `stringArray` · **Default:** `[]`

#### slot: scoreColumn

The column to use as a "score" attribute

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:** `''`

#### slot: autoSql

The autoSql definition for the data fields in the file

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:** `''`

#### slot: disableGeneHeuristic

Disable the heuristic that auto-detects BED12 features as gene/transcript
structures. Useful for files that have BED12-like structure but are not genes
(e.g. tandem duplications)

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`false`

</details>
