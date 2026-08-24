---
id: gff3adapter
title: Gff3Adapter
sidebar_label: Adapter -> Gff3Adapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `gff3` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gff3/src/Gff3Adapter/configSchema.ts).

## Example usage

```js
{
  type: 'FeatureTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'Gff3Adapter',
    uri: 'https://example.com/genes.gff3',
  },
}
```

_See the **Config slots** section below for all available configuration fields._

used to load plain-text GFF3 files. Loads the whole file into memory, so prefer
the Gff3TabixAdapter for large files.

## Related links

- **Track:** [FeatureTrack](../featuretrack)
- **Display:** [LinearArcDisplay](../lineararcdisplay)
- **Display:** [LinearBasicDisplay](../linearbasicdisplay)
- **Display:** [LinearMultiRowFeatureDisplay](../linearmultirowfeaturedisplay)

## Config slots

These slots go inside the track's `adapter`:
`"adapter": { "type": "Gff3Adapter", ... }`. It also accepts the
[shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`,
`baseUri` in place of writing a location slot out. Slot types (`fileLocation`,
`frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types). Slots a base
configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-gfflocation">**gffLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.gff', locationType: 'UriLocation' }</code> | location of the GFF3 file. May be gzipped; it is decompressed and parsed in full on first use, so the file has to fit in memory. |
