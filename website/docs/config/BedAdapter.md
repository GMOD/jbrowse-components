---
id: bedadapter
title: BedAdapter
description: "Reads plain-text BED files. The adapter loads the whole file into memory, so use BedTabixAdapter for large files."
sidebar_label: Adapter -> BedAdapter
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `bed` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/bed/src/BedAdapter/configSchema.ts).

Reads plain-text BED files. The adapter loads the whole file into memory, so
use `BedTabixAdapter` for large files.

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

JBrowse infers `BedAdapter` and `FeatureTrack` from `features.bed`, and `name` defaults to the file name. In a config declaring one assembly, `assemblyNames` comes from there too — see [the shortest track](/docs/config_guides/tracks#the-shortest-track).

```js
{
  trackId: 'my_track',
  uri: 'https://example.com/features.bed',
  assemblyNames: ['hg38'],
}
```

:::caution Gotcha

Named BED columns past `name`/`score`/`strand` (`itemRgb`, `thickStart`, ...) are only guaranteed for BED12 or a track with an `autoSql`/`columnNames`. For a BED7-BED11 file JBrowse cannot know what the extra columns mean, so it exposes them generically as `field6`, `field7`, ... and `feature.itemRgb` reads as `undefined` in a jexl callback. Set `columnNames` to refer to them by name.

:::

## Related links

- **Track:** [FeatureTrack](../featuretrack)
- **Display:** [LinearBasicDisplay](../linearbasicdisplay)
- **Display:** [LinearManhattanDisplay](../linearmanhattandisplay)
- **Display:** [LinearMarkDisplay](../linearmarkdisplay)
- **Display:** [LinearMultiRowFeatureDisplay](../linearmultirowfeaturedisplay)
- **Display:** [LinearScoreDisplay](../linearscoredisplay)
- **Display:** [LinearWiggleDisplay](../linearwiggledisplay)

## Config slots

Adapter slots go inside the track's `adapter`: `"adapter": { "type": "BedAdapter", ... }`. It also accepts the [shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`, `baseUri` in place of writing a location slot out. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-bedlocation">**bedLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.bed.gz', locationType: 'UriLocation' }</code> | path to bed file, also allows gzipped bed |
| <span id="slot-columnnames">**columnNames**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | List of column names. A column named like a standard BED column is parsed as that column's type (chromStart numeric, blockSizes a numeric list); any other column is text |
| <span id="slot-scorecolumn">**scoreColumn**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | The column to use as a "score" attribute |
| <span id="slot-autosql">**autoSql**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | The autoSql definition for the data fields in the file |
| <span id="slot-colref">**colRef**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | The column to use as a "refName" attribute |
| <span id="slot-colstart">**colStart**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | The column to use as a "start" attribute |
| <span id="slot-colend">**colEnd**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>2</code> | The column to use as a "end" attribute |
| <span id="slot-disablegeneheuristic">**disableGeneHeuristic**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Disable the heuristic that auto-detects BED12 features as gene/transcript structures. Useful for files that have BED12-like structure but are not genes (e.g. tandem duplications) |
