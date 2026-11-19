---
id: genbankadapter
title: GenbankAdapter
description: "Reads the features of a GenBank flat file, one reference sequence per LOCUS record, named by its VERSION accession or else its LOCUS name."
sidebar_label: Adapter -> GenbankAdapter
---

Auto-generated from the config schema in the source. See the [config guide](/docs/config_guide) for concepts. Provided by the `gff3` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gff3/src/GenbankAdapter/configSchema.ts).

Reads the features of a GenBank flat file, one reference sequence per
`LOCUS` record, named by its `VERSION` accession or else its `LOCUS` name.
`GenbankSequenceAdapter` reads the same file's sequence, so one file can be
a whole assembly.

## Example usage

```js
{
  type: 'FeatureTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'GenbankAdapter',
    uri: 'https://example.com/plasmid.gbk',
  },
}
```

JBrowse infers `GenbankAdapter` and `FeatureTrack` from `plasmid.gbk`, and `name` defaults to the file name. In a config declaring one assembly, `assemblyNames` comes from there too — see [the shortest track](/docs/config_guides/tracks#the-shortest-track).

```js
{
  trackId: 'my_track',
  uri: 'https://example.com/plasmid.gbk',
  assemblyNames: ['hg38'],
}
```

## Related links

- **Track:** [FeatureTrack](../featuretrack)
- **Display:** [LinearBasicDisplay](../linearbasicdisplay)
- **Display:** [LinearManhattanDisplay](../linearmanhattandisplay)
- **Display:** [LinearMarkDisplay](../linearmarkdisplay)
- **Display:** [LinearMultiRowFeatureDisplay](../linearmultirowfeaturedisplay)
- **Display:** [LinearScoreDisplay](../linearscoredisplay)
- **Display:** [LinearWiggleDisplay](../linearwiggledisplay)

## Config slots

Adapter slots go inside the track's `adapter`: `"adapter": { "type": "GenbankAdapter", ... }`. It also accepts the [shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`, `baseUri` in place of writing a location slot out. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-genbanklocation">**genbankLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.gbk', locationType: 'UriLocation' }</code> | location of the GenBank file. May be gzipped; it is decompressed and parsed in full on first use, so the file has to fit in memory. |
