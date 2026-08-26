---
id: chromsizesadapter
title: ChromSizesAdapter
sidebar_label: Adapter -> ChromSizesAdapter
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `sequence` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sequence/src/ChromSizesAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'ReferenceSequenceTrack',
  trackId: 'my_assembly-ReferenceSequenceTrack',
  adapter: {
    type: 'ChromSizesAdapter',
    uri: 'https://example.com/species.chrom.sizes',
  },
}
```

_See the **Config slots** section below for all available configuration fields._

loads only chromosome names and lengths from a UCSC-style `.chrom.sizes` file
(tab-separated `name<TAB>length`), with no actual sequence. Useful for
karyotype or whole-genome/synteny views where the base-level sequence isn't
needed.

## Related links

- **Track:** [ReferenceSequenceTrack](../referencesequencetrack)
- **Display:** [LinearGCContentDisplay](../lineargccontentdisplay)
- **Display:** [LinearReferenceSequenceDisplay](../linearreferencesequencedisplay)

## Config slots

These slots go inside the track's `adapter`: `"adapter": { "type": "ChromSizesAdapter", ... }`. It also accepts the [shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`, `baseUri` in place of writing a location slot out. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-chromsizeslocation">**chromSizesLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ uri: '/path/to/species.chrom.sizes', locationType: 'UriLocati…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ uri: '/path/to/species.chrom.sizes', locationType: 'UriLocation' }</code></pre></dialog></span> | location of the `.chrom.sizes` file — one `name<TAB>length` line per reference sequence. There is no sequence behind it, so base-level views of this assembly are empty. |
