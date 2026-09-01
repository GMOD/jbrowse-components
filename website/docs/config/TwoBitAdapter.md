---
id: twobitadapter
title: TwoBitAdapter
sidebar_label: Adapter -> TwoBitAdapter
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `sequence` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sequence/src/TwoBitAdapter/configSchema.ts).

## Example usage

A `.2bit` file is self-contained; add `chromSizes` to skip an initial
full-file scan on genomes with many contigs:

```js
{
  type: 'ReferenceSequenceTrack',
  trackId: 'my_assembly-ReferenceSequenceTrack',
  adapter: {
    type: 'TwoBitAdapter',
    uri: 'https://example.com/genome.2bit',
  },
}
```

_See the **Config slots** section below for all available configuration fields._

## Related links

- **Track:** [ReferenceSequenceTrack](../referencesequencetrack)
- **Display:** [LinearGCContentDisplay](../lineargccontentdisplay)
- **Display:** [LinearReferenceSequenceDisplay](../linearreferencesequencedisplay)

## Config slots

These slots go inside the track's `adapter`: `"adapter": { "type": "TwoBitAdapter", ... }`. It also accepts the [shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`, `baseUri`, `chromSizes` in place of writing a location slot out. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-twobitlocation">**twoBitLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.2bit', locationType: 'UriLocation' }</code> | location of the UCSC `.2bit` file. It is self-contained — sequence and index in one file — but its per-sequence header is spread through the file, so a genome with many contigs benefits from `chromSizesLocation`. |
| <span id="slot-chromsizeslocation">**chromSizesLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ uri: '/path/to/default.chrom.sizes', locationType: 'UriLocati…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ uri: '/path/to/default.chrom.sizes', locationType: 'UriLocation' }</code></pre></dialog></span> | An optional chrom.sizes file can be supplied to speed up loading since parsing the twobit file can take time |
