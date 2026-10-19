---
id: bedgraphadapter
title: BedGraphAdapter
description: "Reads plain-text bedGraph signal files. The adapter loads the whole file into memory, so use BedGraphTabixAdapter for large files."
sidebar_label: Adapter -> BedGraphAdapter
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `bed` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/bed/src/BedGraphAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'QuantitativeTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BedGraphAdapter',
    uri: 'https://example.com/signal.bedGraph',
  },
}
```

JBrowse infers `BedGraphAdapter` and `QuantitativeTrack` from `signal.bedGraph`, and `name` defaults to the file name. In a config declaring one assembly, `assemblyNames` comes from there too — see [the shortest track](/docs/config_guides/tracks#the-shortest-track).

```js
{
  trackId: 'my_track',
  uri: 'https://example.com/signal.bedGraph',
  assemblyNames: ['hg38'],
}
```

Reads plain-text bedGraph signal files. The adapter loads the whole file into
memory, so use `BedGraphTabixAdapter` for large files.

Several signals in one file are a `MultiQuantitativeTrack`'s subtracks:
one value column each, named by the header, or a `source` column naming each
row's, which is the form Save track data writes.

## Related links

- **Track:** [QuantitativeTrack](../quantitativetrack)
- **Display:** [LinearMarkDisplay](../linearmarkdisplay)
- **Display:** [LinearWiggleDisplay](../linearwiggledisplay)

## Config slots

Adapter slots go inside the track's `adapter`: `"adapter": { "type": "BedGraphAdapter", ... }`. It also accepts the [shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`, `baseUri` in place of writing a location slot out. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-bedgraphlocation">**bedGraphLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.bedgraph', locationType: 'UriLocation' }</code> | location of the plain-text bedGraph (`chrom start end value`, one line per interval). May be gzipped. |
| <span id="slot-columnnames">**columnNames**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | List of column names |
