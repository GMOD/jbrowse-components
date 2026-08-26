---
id: bedgraphadapter
title: BedGraphAdapter
sidebar_label: Adapter -> BedGraphAdapter
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `bed` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/bed/src/BedGraphAdapter/configSchema.ts).

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

_See the **Config slots** section below for all available configuration fields._

used to load plain-text bedGraph signal files. Loads the whole file into
memory, so prefer the BedGraphTabixAdapter for large files.

## Related links

- **Track:** [QuantitativeTrack](../quantitativetrack)
- **Display:** [LinearWiggleDisplay](../linearwiggledisplay)

## Config slots

These slots go inside the track's `adapter`: `"adapter": { "type": "BedGraphAdapter", ... }`. It also accepts the [shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`, `baseUri` in place of writing a location slot out. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-bedgraphlocation">**bedGraphLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.bedgraph', locationType: 'UriLocation' }</code> | location of the plain-text bedGraph (`chrom start end value`, one line per interval). May be gzipped. |
| <span id="slot-columnnames">**columnNames**</span><br>`stringArray` = <code>[]</code> | List of column names |
