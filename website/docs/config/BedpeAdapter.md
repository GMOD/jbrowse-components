---
id: bedpeadapter
title: BedpeAdapter
sidebar_label: Adapter -> BedpeAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `bed` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/bed/src/BedpeAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'VariantTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BedpeAdapter',
    uri: 'https://example.com/sv.bedpe',
  },
}
```

`sv.bedpe` infers `BedpeAdapter` and `VariantTrack` on its own, so the same
track can be written as an id and a uri. `name` then defaults to the file name,
and `assemblyNames` is implied for a config holding one assembly — see
[the shortest track](/docs/config_guides/tracks#the-shortest-track).

```js
{
  trackId: 'my_track',
  uri: 'https://example.com/sv.bedpe',
  assemblyNames: ['hg38'],
}
```

_See the **Config slots** section below for all available configuration fields._

intended for SVs in a single assembly

## Related links

- **Track:** [VariantTrack](../varianttrack)
- **Display:** [ChordVariantDisplay](../chordvariantdisplay)
- **Display:** [LDDisplay](../lddisplay)
- **Display:**
  [LinearMultiSampleVariantDisplay](../linearmultisamplevariantdisplay)
- **Display:**
  [LinearMultiSampleVariantMatrixDisplay](../linearmultisamplevariantmatrixdisplay)
- **Display:** [LinearPairedArcDisplay](../linearpairedarcdisplay)
- **Display:** [LinearVariantDisplay](../linearvariantdisplay)

## Config slots

These slots go inside the track's `adapter`:
`"adapter": { "type": "BedpeAdapter", ... }`. It also accepts the
[shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`,
`baseUri` in place of writing a location slot out. Slot types (`fileLocation`,
`frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types). Slots a base
configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-bedpelocation">**bedpeLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.bedpe.gz', locationType: 'UriLocation' }</code> | can be plaintext or gzipped, not indexed so loaded into memory on startup |
| <span id="slot-columnnames">**columnNames**</span><br>`stringArray` = <code>[]</code> | List of column names |
