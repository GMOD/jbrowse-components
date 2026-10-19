---
id: bedgraphtabixadapter
title: BedGraphTabixAdapter
description: "Reads bgzip-compressed, tabix-indexed bedGraph signal files."
sidebar_label: Adapter -> BedGraphTabixAdapter
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `bed` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/bed/src/BedGraphTabixAdapter/configSchema.ts).

Reads bgzip-compressed, tabix-indexed bedGraph signal files.

Several signals in one file are a `MultiQuantitativeTrack`'s subtracks:
one value column each, named by the header, or a `source` column naming each
row's, which is the form Save track data writes.

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

JBrowse infers `BedGraphTabixAdapter` and `QuantitativeTrack` from `signal.bedGraph.gz`, and `name` defaults to the file name. In a config declaring one assembly, `assemblyNames` comes from there too — see [the shortest track](/docs/config_guides/tracks#the-shortest-track).

```js
{
  trackId: 'my_track',
  uri: 'https://example.com/signal.bedGraph.gz',
  assemblyNames: ['hg38'],
}
```

## Related links

- **Track:** [QuantitativeTrack](../quantitativetrack)
- **Display:** [LinearMarkDisplay](../linearmarkdisplay)
- **Display:** [LinearWiggleDisplay](../linearwiggledisplay)

## Config slots

Adapter slots go inside the track's `adapter`: `"adapter": { "type": "BedGraphTabixAdapter", ... }`. It also accepts the [shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`, `baseUri`, `csi` in place of writing a location slot out. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-bedgraphgzlocation">**bedGraphGzLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.bedgraph', locationType: 'UriLocation' }</code> | location of the bgzip-compressed bedGraph (`chrom start end value`, sorted by position). Must be bgzip rather than plain gzip, which tabix cannot index. |
| <span id="slot-index">**index**</span><br>[TabixIndex](../tabixindex) | The tabix index location and its kind. The `uri` shorthand derives both, so a config using it states neither. |
| <span id="slot-columnnames">**columnNames**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | List of column names |
