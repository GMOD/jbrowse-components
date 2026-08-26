---
id: bigmafadapter
title: BigMafAdapter
sidebar_label: Adapter -> BigMafAdapter
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `maf` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/maf/src/BigMafAdapter/configSchema.ts).

## Example usage

`samples` names the rows in the order they are drawn, and has to match the
species keys in the file — a bigMaf carries the alignment but not a display
order, so an omitted or misspelled name shows as a missing row rather than an
error:
```js
{
  type: 'MafTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BigMafAdapter',
    bigBedLocation: { uri: 'https://example.com/multiz.bb' },
    samples: ['hg38', 'panTro6', 'rheMac10', 'mm39'],
  },
}
```

_See the **Config slots** section below for all available configuration fields._

used to configure BigMaf adapter

## Related links

- **Track:** [MafTrack](../maftrack)
- **Display:** [LinearMafDisplay](../linearmafdisplay)

## Config slots

These slots go inside the track's `adapter`: `"adapter": { "type": "BigMafAdapter", ... }`. This adapter has no `uri` [shorthand](/docs/config_guides/file_types#the-uri-shorthand) — give it the location slots below. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-samples">**samples**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>[]</code> | string[] or {id:string,label:string,color?:string,assemblyName?:string,assemblyConfigLocation?:UriLocation}[]; assemblyName makes rows for that sample navigable to its own genome, and assemblyConfigLocation says where to load that assembly from when the session lacks it |
| <span id="slot-bigbedlocation">**bigBedLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.bb', locationType: 'UriLocation' }</code> | location of the bigMaf file — a BigBed whose extra field holds the MAF alignment block, as built by UCSC's `mafToBigMaf` followed by `bedToBigBed -type=bed3+1 -as=bigMaf.as -tab`. |
| <span id="slot-nhlocation">**nhLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.nh', locationType: 'UriLocation' }</code> | newick tree |
| <span id="slot-summaryadapter">**summaryAdapter**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>null</code> | optional swappable sub-adapter (e.g. a BigBedAdapter over UCSC bigMafSummary.bb) used for cheap zoom-out rendering; null disables it |
| <span id="slot-annotationadapter">**annotationAdapter**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>null</code> | optional sub-adapter (typically a BigBedAdapter over a UCSC multiz<N>wayFrames.bb) supplying per-species CDS reading frames for the gene-structure overlay and codon view; null disables it |
