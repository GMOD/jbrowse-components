---
id: genbanksequenceadapter
title: GenbankSequenceAdapter
description: "Reads the ORIGIN sequence of each record of a GenBank flat file, named as GenbankAdapter names them, so the same file serves as an assembly and as its feature track."
sidebar_label: Adapter -> GenbankSequenceAdapter
---

Auto-generated from the config schema in the source. See the [config guide](/docs/config_guide) for concepts. Provided by the `gff3` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gff3/src/GenbankSequenceAdapter/configSchema.ts).

Reads the `ORIGIN` sequence of each record of a GenBank flat file, named as
`GenbankAdapter` names them, so the same file serves as an assembly and as
its feature track. A record whose `LOCUS` line says `circular` gives a
circular sequence.

## Example usage

```js
{
  type: 'ReferenceSequenceTrack',
  trackId: 'my_assembly-ReferenceSequenceTrack',
  adapter: {
    type: 'GenbankSequenceAdapter',
    uri: 'https://example.com/plasmid.gbk',
  },
}
```

## Related links

- **Track:** [ReferenceSequenceTrack](../referencesequencetrack)
- **Display:** [LinearReferenceSequenceDisplay](../linearreferencesequencedisplay)

## Config slots

Adapter slots go inside the track's `adapter`: `"adapter": { "type": "GenbankSequenceAdapter", ... }`. It also accepts the [shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`, `baseUri` in place of writing a location slot out. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-genbanklocation">**genbankLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.gbk', locationType: 'UriLocation' }</code> | location of the GenBank file. May be gzipped; it is decompressed and parsed in full on first use, so the file has to fit in memory. |
