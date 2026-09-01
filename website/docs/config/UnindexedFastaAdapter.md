---
id: unindexedfastaadapter
title: UnindexedFastaAdapter
sidebar_label: Adapter -> UnindexedFastaAdapter
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `sequence` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sequence/src/UnindexedFastaAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'ReferenceSequenceTrack',
  trackId: 'my_assembly-ReferenceSequenceTrack',
  adapter: {
    type: 'UnindexedFastaAdapter',
    uri: 'https://example.com/genome.fa',
  },
}
```

_See the **Config slots** section below for all available configuration fields._

loads a plain (non-bgzipped) FASTA without a separate index. Reads the whole
sequence into memory, so prefer the IndexedFastaAdapter for large genomes.

## Related links

- **Track:** [ReferenceSequenceTrack](../referencesequencetrack)
- **Display:** [LinearGCContentDisplay](../lineargccontentdisplay)
- **Display:** [LinearReferenceSequenceDisplay](../linearreferencesequencedisplay)

## Config slots

These slots go inside the track's `adapter`: `"adapter": { "type": "UnindexedFastaAdapter", ... }`. It also accepts the [shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`, `baseUri` in place of writing a location slot out. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-rewriterefnames">**rewriteRefNames**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | jexl expression rewriting each sequence name as the FASTA is parsed, e.g. `jexl:split(refName, ' ')[0]` to keep only the first word of a description line. Left empty, names are used as written; an expression returning nothing falls back to the original name.<br>_callback args:_ `refName` |
| <span id="slot-fastalocation">**fastaLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/seq.fa', locationType: 'UriLocation' }</code> | location of the plain FASTA. With no index there are no byte offsets to seek to, so the whole file is downloaded and parsed on first use and held in memory. |
| <span id="slot-metadatalocation">**metadataLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ uri: '/path/to/fa.metadata.yaml', locationType: 'UriLocation'…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ uri: '/path/to/fa.metadata.yaml', locationType: 'UriLocation' }</code></pre></dialog></span> | Optional metadata file |
