---
id: bgzipfastaadapter
title: BgzipFastaAdapter
sidebar_label: Adapter -> BgzipFastaAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `sequence`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sequence/src/BgzipFastaAdapter/configSchema.ts).

## Example usage

The `uri` shorthand auto-resolves the `.fai` and `.gzi` indexes:

```js
{
  type: 'ReferenceSequenceTrack',
  trackId: 'my_assembly-ReferenceSequenceTrack',
  adapter: {
    type: 'BgzipFastaAdapter',
    uri: 'https://example.com/genome.fa.gz',
  },
}
```

_See the **Config slots** section below for all available configuration fields._

## Related links

- **Track:** [ReferenceSequenceTrack](../referencesequencetrack)
- **Display:**
  [LinearReferenceSequenceDisplay](../linearreferencesequencedisplay)

## Config slots

These slots go inside the track's `adapter`:
`"adapter": { "type": "BgzipFastaAdapter", ... }`. Slot types (`fileLocation`,
`frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types). Slots a base
configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-fastalocation">**fastaLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/seq.fa.gz', locationType: 'UriLocation' }</code> |  |
| <span id="slot-failocation">**faiLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/seq.fa.gz.fai', locationType: 'UriLocation' }</code> |  |
| <span id="slot-metadatalocation">**metadataLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ uri: '/path/to/fa.metadata.yaml', locationType: 'UriLocation'…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ uri: '/path/to/fa.metadata.yaml', locationType: 'UriLocation' }</code></pre></dialog></span> | Optional metadata file |
| <span id="slot-gzilocation">**gziLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/seq.fa.gz.gzi', locationType: 'UriLocation' }</code> |  |
