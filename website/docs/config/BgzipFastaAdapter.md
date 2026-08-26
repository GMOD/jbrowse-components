---
id: bgzipfastaadapter
title: BgzipFastaAdapter
sidebar_label: Adapter -> BgzipFastaAdapter
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `sequence` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sequence/src/BgzipFastaAdapter/configSchema.ts).

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
- **Display:** [LinearGCContentDisplay](../lineargccontentdisplay)
- **Display:** [LinearReferenceSequenceDisplay](../linearreferencesequencedisplay)

## Config slots

These slots go inside the track's `adapter`: `"adapter": { "type": "BgzipFastaAdapter", ... }`. It also accepts the [shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`, `baseUri` in place of writing a location slot out. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-fastalocation">**fastaLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/seq.fa.gz', locationType: 'UriLocation' }</code> | location of the bgzip-compressed FASTA. Must be bgzip rather than plain gzip — `samtools faidx` cannot index the latter, and only bgzip supports the per-block random access that keeps a base-level view to one range request. |
| <span id="slot-failocation">**faiLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/seq.fa.gz.fai', locationType: 'UriLocation' }</code> | location of the `samtools faidx` index (`.fai`). It supplies the reference names and lengths as well as the offsets into the uncompressed sequence, so the assembly cannot load without it. |
| <span id="slot-metadatalocation">**metadataLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ uri: '/path/to/fa.metadata.yaml', locationType: 'UriLocation'…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ uri: '/path/to/fa.metadata.yaml', locationType: 'UriLocation' }</code></pre></dialog></span> | Optional metadata file |
| <span id="slot-gzilocation">**gziLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/seq.fa.gz.gzi', locationType: 'UriLocation' }</code> | location of the bgzip block index (`.gzi`), written beside the `.fai` by `samtools faidx` on a bgzipped FASTA. It maps uncompressed offsets to compressed ones, which is what makes a range request possible at all. |
