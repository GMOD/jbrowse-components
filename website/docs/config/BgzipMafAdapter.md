---
id: bgzipmafadapter
title: BgzipMafAdapter
sidebar_label: Adapter -> BgzipMafAdapter
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `maf` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/maf/src/BgzipMafAdapter/configSchema.ts).

## Example usage

The `uri` shorthand auto-resolves the sibling `.tai` index; `nhUri` names the
Newick tree:

```js
{
  type: 'MafTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BgzipMafAdapter',
    uri: 'https://example.com/aln.maf.gz',
  },
}
```

_See the **Config slots** section below for all available configuration fields._

A bgzip-compressed MAF with a Taffy `.tai` index — the form whole-genome
multiple alignments are actually distributed in. HPRC release 2 publishes
`hprc-v2.1-mc-grch38.full.maf.gz` (53 GB, 464 haplotypes) with a sibling
`.tai`, and Cactus/taffy write the pair for any HAL export. The index gives
random access, so a locus is a small ranged read rather than a download: a
10 kb query against HPRC's own index resolves to about 924 KB.

Use `BgzipTaffyAdapter` for TAF (taffy's own, more compact format),
`MafTabixAdapter` for a `maf2bed` BED, and `BigMafAdapter` for bigMaf.

## Related links

- **Track:** [MafTrack](../maftrack)
- **Display:** [LinearMafDisplay](../linearmafdisplay)

## Config slots

These slots go inside the track's `adapter`: `"adapter": { "type": "BgzipMafAdapter", ... }`. It also accepts the [shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`, `baseUri`, `nhUri` in place of writing a location slot out. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-samples">**samples**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>[]</code> | string[] or {id:string,label:string,color?:string,assemblyName?:string}[]; assemblyName makes rows for that sample navigable to its own genome |
| <span id="slot-mafgzlocation">**mafGzLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.maf.gz', locationType: 'UriLocation' }</code> | bgzip-compressed MAF file |
| <span id="slot-tailocation">**taiLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.maf.gz.tai', locationType: 'UriLocation' }</code> | The Taffy index. The same `.tai` format `BgzipTaffyAdapter` reads — it describes bgzf virtual offsets against reference coordinates and does not care which text format sits inside — so `taffy index` produces it for a MAF as readily as for a TAF. |
| <span id="slot-nhlocation">**nhLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.nh', locationType: 'UriLocation' }</code> | newick tree |
| <span id="slot-summaryadapter">**summaryAdapter**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>null</code> | The zoom-out tier. The `.tai` makes a read cost the span on screen rather than the blocks it lands in, which is why this slot was left off at first — but span is only half of it. Cost is span × depth, and measured against HPRC's own v2.1 index the constant is about **19 compressed bytes per bp** at 464 haplotypes, flat from 100 kb up: 1 Mb is a 19 MB read and chr1 whole is 4.4 GB. So a deep alignment still runs out, just linearly instead of by block. Point it at a `BedTabixAdapter` over the summary BED `maf2bed --summary` writes, or at a `BigBedAdapter` over a UCSC `bigMafSummary.bb` covering the same alignment. |
| <span id="slot-annotationadapter">**annotationAdapter**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>null</code> | The CDS reading frames, in the same shape and read by the same code as the other three MAF adapters' — the display looks the slot up by path off the parent track (`['adapter', 'annotationAdapter']`) and is otherwise format-blind. This adapter was the one of the four that never declared it, so the read simply returned undefined and every consumer of it — the CDS strip, the codon row coloring, the codon conservation band, and the menu rows that gate on the slot's presence — was silently unavailable on a `.maf.gz` track, with nothing on screen saying why. |
