---
id: bgziptaffyadapter
title: BgzipTaffyAdapter
sidebar_label: Adapter -> BgzipTaffyAdapter
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `maf` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/maf/src/BgzipTaffyAdapter/configSchema.ts).

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
    type: 'BgzipTaffyAdapter',
    uri: 'https://example.com/aln.taf.gz',
  },
}
```

_See the **Config slots** section below for all available configuration fields._

used to configure BgzipTaffy adapter

## Related links

- **Track:** [MafTrack](../maftrack)
- **Display:** [LinearMafDisplay](../linearmafdisplay)

## Config slots

These slots go inside the track's `adapter`: `"adapter": { "type": "BgzipTaffyAdapter", ... }`. It also accepts the [shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`, `baseUri`, `nhUri` in place of writing a location slot out. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-samples">**samples**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>[]</code> | string[] or {id:string,label:string,color?:string,assemblyName?:string}[]; assemblyName makes rows for that sample navigable to its own genome |
| <span id="slot-tafgzlocation">**tafGzLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.taf.gz', locationType: 'UriLocation' }</code> | bgzip taffy file |
| <span id="slot-tailocation">**taiLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.taf.gz.tai', locationType: 'UriLocation' }</code> | taffy index |
| <span id="slot-nhlocation">**nhLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.nh', locationType: 'UriLocation' }</code> | newick tree |
| <span id="slot-summaryadapter">**summaryAdapter**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>null</code> | The zoom-out tier, on the same terms as `BgzipMafAdapter`'s: the `.tai` makes a read cost the span on screen rather than the blocks it lands in, but cost is span × depth and a deep alignment runs out of the second factor. Measured against HPRC's published v2.0 TAF index, 464 haplotypes cost about **2 compressed bytes per bp**, flat from 100 kb up — a ninth of the same alignment's MAF, and still 354 MB for chr6 whole. TAF moves the ceiling out by about 10x; it does not remove it. Point this at a `BedTabixAdapter` over a `maf2bed --summary` BED, or at a `BigBedAdapter` over a UCSC `bigMafSummary.bb`. |
| <span id="slot-annotationadapter">**annotationAdapter**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>null</code> | optional sub-adapter (typically a BigBedAdapter over a UCSC multiz<N>wayFrames.bb) supplying per-species CDS reading frames for the gene-structure overlay and codon view; null disables it |
