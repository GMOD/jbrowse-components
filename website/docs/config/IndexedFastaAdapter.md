---
id: indexedfastaadapter
title: IndexedFastaAdapter
sidebar_label: Adapter -> IndexedFastaAdapter
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `sequence` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sequence/src/IndexedFastaAdapter/configSchema.ts).

## Example usage

The `uri` shorthand auto-resolves the `.fai` index:

```js
{
  type: 'ReferenceSequenceTrack',
  trackId: 'my_assembly-ReferenceSequenceTrack',
  adapter: {
    type: 'IndexedFastaAdapter',
    uri: 'https://example.com/genome.fa',
  },
}
```

_See the **Config slots** section below for all available configuration fields._

## Related links

- **Track:** [ReferenceSequenceTrack](../referencesequencetrack)
- **Display:** [LinearGCContentDisplay](../lineargccontentdisplay)
- **Display:** [LinearReferenceSequenceDisplay](../linearreferencesequencedisplay)

## Config slots

These slots go inside the track's `adapter`: `"adapter": { "type": "IndexedFastaAdapter", ... }`. It also accepts the [shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`, `baseUri` in place of writing a location slot out. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-fastalocation">**fastaLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/seq.fa', locationType: 'UriLocation' }</code> | location of the FASTA file. Only the visible bases are fetched, as byte ranges resolved through the `.fai`, so the file itself is never downloaded whole. |
| <span id="slot-failocation">**faiLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/seq.fa.fai', locationType: 'UriLocation' }</code> | location of the `samtools faidx` index (`.fai`). It supplies the reference names and lengths as well as the byte offsets, so the assembly cannot load without it. |
| <span id="slot-metadatalocation">**metadataLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ uri: '/path/to/fa.metadata.yaml', locationType: 'UriLocation'…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ uri: '/path/to/fa.metadata.yaml', locationType: 'UriLocation' }</code></pre></dialog></span> | Optional metadata file |
