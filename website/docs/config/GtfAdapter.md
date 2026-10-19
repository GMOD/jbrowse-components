---
id: gtfadapter
title: GtfAdapter
description: "Reads plain-text GTF files, optionally gzipped. The adapter loads the whole file into memory, so use GtfTabixAdapter for large files."
sidebar_label: Adapter -> GtfAdapter
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `gtf` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gtf/src/GtfAdapter/configSchema.ts).

Reads plain-text GTF files, optionally gzipped. The adapter loads the whole
file into memory, so use `GtfTabixAdapter` for large files.

## Example usage

The `uri` shorthand works for plain or gzipped GTF:

```js
{
  type: 'FeatureTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'GtfAdapter',
    uri: 'https://example.com/genes.gtf',
  },
}
```

JBrowse infers `GtfAdapter` and `FeatureTrack` from `genes.gtf`, and `name` defaults to the file name. In a config declaring one assembly, `assemblyNames` comes from there too — see [the shortest track](/docs/config_guides/tracks#the-shortest-track).

```js
{
  trackId: 'my_track',
  uri: 'https://example.com/genes.gtf',
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

Adapter slots go inside the track's `adapter`: `"adapter": { "type": "GtfAdapter", ... }`. It also accepts the [shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`, `baseUri` in place of writing a location slot out. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-gtflocation">**gtfLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.gtf', locationType: 'UriLocation' }</code> | path to gtf file, also allows for gzipped gtf |
| <span id="slot-aggregatefield">**aggregateField**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'gene_name'</code> | attribute naming the parent gene that the adapter aggregates transcripts into. The adapter groups transcripts by gene_id where the file has one (gene names are not unique within a reference), so this is the gene label, and the grouping key only for files with no gene_id |
