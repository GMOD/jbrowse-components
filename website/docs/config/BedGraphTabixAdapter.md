---
id: bedgraphtabixadapter
title: BedGraphTabixAdapter
description: "Reads bgzip-compressed, tabix-indexed bedGraph signal files."
sidebar_label: Adapter -> BedGraphTabixAdapter
---

Auto-generated from the config schema in the source. See the [config guide](/docs/config_guide) for concepts. Provided by the `bed` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/bed/src/BedGraphTabixAdapter/configSchema.ts).

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

Per-column metadata from a table whose first column names each value column
as the header does; the track shows only the columns the table lists:

```js
{
  type: 'QuantitativeTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BedGraphTabixAdapter',
    uri: 'https://example.com/cohort.bedgraph.gz',
    samplesTsvLocation: { uri: 'https://example.com/samples.tsv' },
  },
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
| <span id="slot-samplestsvlocation">**samplesTsvLocation**</span><br>[`maybeFileLocation`](/docs/config_guides/slot_types#the-maybe-types) | optional tab-separated table of per-sample metadata. It needs a header row, whose first cell is not read, and its first column is the sample name exactly as the adapter spells it: a VCF sample, a MultiWiggle subtrack's name, a bedGraph value column's header name, a MAF species id. Every other column (`population`, `tissue`, ...) becomes an attribute of that sample, which the variant and wiggle displays, and a mark display over a MultiWiggle, group, sort, color and tooltip rows by, and a blank cell is no value; `label` and `color` name and color the row. A VCF's table ignores a `sampleName`, `HP` or `sole` column, with a warning, since the variant display writes those fields on its haplotype rows. A MAF adapter reads only the `label`, `color` and `assemblyName` columns onto its species rows, over its `samples` entries. The table also narrows the adapter's samples to the ones it lists, with a warning naming the rest, and a table naming none of them is an error. An adapter that names no samples (a MAF track discovering its species from the file) takes the table's rows as its samples |
