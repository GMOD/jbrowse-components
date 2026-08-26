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

`features.bed.gz` infers `BedTabixAdapter` and `FeatureTrack` on its own, and
`name` defaults to the file name. In a config declaring one assembly,
`assemblyNames` comes from there too — see
[the shortest track](/docs/config_guides/tracks#the-shortest-track).

```js
{
  trackId: 'my_track',
  uri: 'https://example.com/features.bed.gz',
  assemblyNames: ['hg38'],
}
```

_See the **Config slots** section below for all available configuration fields._

## Related links

- **Track:** [FeatureTrack](../featuretrack)
- **Display:** [LinearArcDisplay](../lineararcdisplay)
- **Display:** [LinearBasicDisplay](../linearbasicdisplay)
- **Display:** [LinearMultiRowFeatureDisplay](../linearmultirowfeaturedisplay)
- **Display:** [LinearScoreDisplay](../linearscoredisplay)
- **Extended by:** [GWASAdapter](../gwasadapter)

## Config slots

These slots go inside the track's `adapter`:
`"adapter": { "type": "BedTabixAdapter", ... }`. It also accepts the
[shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`,
`baseUri`, `csi` in place of writing a location slot out. Slot types
(`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types). Slots a base
configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-bedgzlocation">**bedGzLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.bed.gz', locationType: 'UriLocation' }</code> | location of the bgzip-compressed BED, sorted by position. Must be bgzip rather than plain gzip, which tabix cannot index. |
| <span id="slot-columnnames">**columnNames**</span><br>`stringArray` = <code>[]</code> | List of column names. A column named like a standard BED column is parsed as that column's type (chromStart numeric, blockSizes a numeric list); any other column is text |
| <span id="slot-scorecolumn">**scoreColumn**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | The column to use as a "score" attribute |
| <span id="slot-autosql">**autoSql**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | The autoSql definition for the data fields in the file |
| <span id="slot-disablegeneheuristic">**disableGeneHeuristic**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Disable the heuristic that auto-detects BED12 features as gene/transcript structures. Useful for files that have BED12-like structure but are not genes (e.g. tandem duplications) |
| <span id="slot-indexindextype">**index.indexType**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (TBI, CSI) = <code>'TBI'</code> | `TBI` is the usual `tabix` output. `CSI` is required for a reference longer than 512 Mb, which TBI cannot address. |
| <span id="slot-indexlocation">**index.location**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.gz.tbi', locationType: 'UriLocation' }</code> | location of the tabix index. Only needed when it is not named `<file>.tbi` (or `.csi`), which is what the `uri` shorthand assumes. |
