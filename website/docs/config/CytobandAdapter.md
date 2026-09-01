---
id: cytobandadapter
title: CytobandAdapter
sidebar_label: Adapter -> CytobandAdapter
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/data_adapters/CytobandAdapter/configSchema.ts).

## Example usage

Goes on an ASSEMBLY, under `cytobands` — not on a track. It draws the
ideogram banding in the linear genome view's overview bar:

```js
{
  name: 'hg38',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'hg38-ReferenceSequenceTrack',
    adapter: {
      type: 'BgzipFastaAdapter',
      uri: 'https://example.com/hg38.fa.gz',
    },
  },
  cytobands: {
    adapter: {
      type: 'CytobandAdapter',
      uri: 'https://example.com/hg38.cytoBand.txt.gz',
    },
  },
}
```

_See the **Config slots** section below for all available configuration fields._

## Config slots

These slots go inside the track's `adapter`: `"adapter": { "type": "CytobandAdapter", ... }`. It also accepts the [shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`, `baseUri` in place of writing a location slot out. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-cytobandlocation">**cytobandLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/cytoband.txt.gz' }</code> | location of a UCSC-style `cytoBand.txt` (`chrom start end name gieStain`), which draws the ideogram banding in the view's overview bar. May be gzipped. Configured on an assembly, not on a track. |
