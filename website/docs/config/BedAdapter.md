---
id: bedadapter
title: BedAdapter
sidebar_label: Adapter -> BedAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `bed` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/bed/src/BedAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'FeatureTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BedAdapter',
    uri: 'https://example.com/features.bed',
  },
}
```

_See the **Config slots** section below for all available configuration fields._

used to load plain-text BED files. Loads the whole file into memory, so prefer
the BedTabixAdapter for large files.

## Related links

- **Track:** [FeatureTrack](../featuretrack)
- **Display:** [LinearArcDisplay](../lineararcdisplay)
- **Display:** [LinearBasicDisplay](../linearbasicdisplay)
- **Display:** [LinearMultiRowFeatureDisplay](../linearmultirowfeaturedisplay)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                               | Type           | Description                                                                           |
| -------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------- |
| [bedLocation](#slot-bedlocation)                   | `fileLocation` | path to bed file, also allows gzipped bed                                             |
| [columnNames](#slot-columnnames)                   | `stringArray`  | List of column names                                                                  |
| [scoreColumn](#slot-scorecolumn)                   | `string`       | The column to use as a "score" attribute                                              |
| [autoSql](#slot-autosql)                           | `string`       | The autoSql definition for the data fields in the file                                |
| [colRef](#slot-colref)                             | `number`       | The column to use as a "refName" attribute                                            |
| [colStart](#slot-colstart)                         | `number`       | The column to use as a "start" attribute                                              |
| [colEnd](#slot-colend)                             | `number`       | The column to use as a "end" attribute                                                |
| [disableGeneHeuristic](#slot-disablegeneheuristic) | `boolean`      | Disable the heuristic that auto-detects BED12 features as gene/transcript structures. |

<details>
<summary>BedAdapter - Slots</summary>

#### slot: bedLocation

path to bed file, also allows gzipped bed

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: '/path/to/my.bed.gz', locationType: 'UriLocation' }`

#### slot: columnNames

List of column names

**Type:** `stringArray` · **Default:** `[]`

#### slot: scoreColumn

The column to use as a "score" attribute

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:** `''`

#### slot: autoSql

The autoSql definition for the data fields in the file

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:** `''`

#### slot: colRef

The column to use as a "refName" attribute

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `0`

#### slot: colStart

The column to use as a "start" attribute

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `1`

#### slot: colEnd

The column to use as a "end" attribute

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `2`

#### slot: disableGeneHeuristic

Disable the heuristic that auto-detects BED12 features as gene/transcript
structures. Useful for files that have BED12-like structure but are not genes
(e.g. tandem duplications)

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`false`

</details>
