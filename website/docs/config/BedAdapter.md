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

:::caution Gotcha

Named BED columns past `name`/`score`/`strand` (`itemRgb`, `thickStart`, ...)
are only guaranteed for BED12 or a track with an `autoSql`/`columnNames`. For a
BED7-BED11 file JBrowse cannot know what the extra columns mean, so it exposes
them generically as `field6`, `field7`, ... and a jexl callback reading
`feature.itemRgb` gets `undefined`. Set `columnNames` to refer to them by name.

:::

used to load plain-text BED files. Loads the whole file into memory, so prefer
the BedTabixAdapter for large files.

## Related links

- **Track:** [FeatureTrack](../featuretrack)
- **Display:** [LinearArcDisplay](../lineararcdisplay)
- **Display:** [LinearBasicDisplay](../linearbasicdisplay)
- **Display:** [LinearMultiRowFeatureDisplay](../linearmultirowfeaturedisplay)

## Config slots

These slots go inside the track's `adapter`:
`"adapter": { "type": "BedAdapter", ... }`. It also accepts the
[shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`,
`baseUri` in place of writing a location slot out. Slot types (`fileLocation`,
`frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types). Slots a base
configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-bedlocation">**bedLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.bed.gz', locationType: 'UriLocation' }</code> | path to bed file, also allows gzipped bed |
| <span id="slot-columnnames">**columnNames**</span><br>`stringArray` = <code>[]</code> | List of column names. A column named like a standard BED column is parsed as that column's type (chromStart numeric, blockSizes a numeric list); any other column is text |
| <span id="slot-scorecolumn">**scoreColumn**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | The column to use as a "score" attribute |
| <span id="slot-autosql">**autoSql**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | The autoSql definition for the data fields in the file |
| <span id="slot-colref">**colRef**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | The column to use as a "refName" attribute |
| <span id="slot-colstart">**colStart**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | The column to use as a "start" attribute |
| <span id="slot-colend">**colEnd**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>2</code> | The column to use as a "end" attribute |
| <span id="slot-disablegeneheuristic">**disableGeneHeuristic**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Disable the heuristic that auto-detects BED12 features as gene/transcript structures. Useful for files that have BED12-like structure but are not genes (e.g. tandem duplications) |
