---
id: maftabixadapter
title: MafTabixAdapter
sidebar_label: Adapter -> MafTabixAdapter
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `maf` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/maf/src/MafTabixAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'MafTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'MafTabixAdapter',
    bedGzLocation: { uri: 'https://example.com/multiz.bed.gz' },
    index: { location: { uri: 'https://example.com/multiz.bed.gz.tbi' } },
    nhLocation: { uri: 'https://example.com/multiz.nh' },
  },
}
```

_See the **Config slots** section below for all available configuration fields._

Multiple alignment format converted to a bgzipped, tabix-indexed BED. The
`nhLocation` newick tree orders and labels the species rows; `refAssemblyName`
names the MAF's reference species when it differs from the assembly name.

## Related links

- **Track:** [MafTrack](../maftrack)
- **Display:** [LinearMafDisplay](../linearmafdisplay)

## Config slots

These slots go inside the track's `adapter`: `"adapter": { "type": "MafTabixAdapter", ... }`. It also accepts the [shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`, `baseUri`, `csi`, `nhUri` in place of writing a location slot out. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-bedgzlocation">**bedGzLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.bed.gz', locationType: 'UriLocation' }</code> | location of the bgzip-compressed BED that `maf2bed` writes from a MAF: one line per alignment block, with every species' aligned bases packed into the last column. |
| <span id="slot-refassemblyname">**refAssemblyName**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | name of the MAF's reference species, spelled as it appears in the file's `s` lines (the `hg38` of `hg38.chr1`). Set it when that differs from the JBrowse assembly name; left empty, the reference row is looked up by the queried assembly's name and falls back to the block's first species. |
| <span id="slot-index">**index**</span><br>[TabixIndex](../tabixindex) | where the tabix index is and which kind it is. The `uri` shorthand derives both, so a config using it states neither. |
| <span id="slot-samples">**samples**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>[]</code> | string[] or {id:string,label:string,color?:string,assemblyName?:string,assemblyConfigLocation?:UriLocation}[]; assemblyName makes rows for that sample navigable to its own genome, and assemblyConfigLocation says where to load that assembly from when the session lacks it |
| <span id="slot-nhlocation">**nhLocation**</span><br>[`maybeFileLocation`](/docs/config_guides/slot_types#the-maybe-types) | newick tree naming and ordering the species rows; its leaf names are the sample ids, and any `samples` entries supply label/color overrides matched by id |
| <span id="slot-summaryadapter">**summaryAdapter**</span><br>[`maybeFrozen`](/docs/config_guides/slot_types#the-maybe-types) | optional swappable sub-adapter (a BedTabixAdapter over a maf2bed --summary BED, or a BigBedAdapter over UCSC bigMafSummary.bb) used for cheap zoom-out rendering; leave it unset to disable. A tabix MAF carries every species' bases on one line, so a wide read downloads the whole alignment and the byte gate blocks it; without this slot the track simply has no zoom-out path |
| <span id="slot-samplestsvlocation">**samplesTsvLocation**</span><br>[`maybeFileLocation`](/docs/config_guides/slot_types#the-maybe-types) | optional tab-separated table of per-sample metadata. It needs a header row, and its first column is the sample name exactly as the adapter spells it: a VCF sample, a MultiWiggle subtrack's name, a MAF species id. Every other column (`population`, `tissue`, ...) becomes an attribute of that sample, which the multi-row displays group, sort, color and tooltip rows by; a MAF adapter reads the `label`, `color` and `assemblyName` columns onto its species rows, over its `samples` entries. The table also narrows the adapter's samples to the ones it lists, and a table naming none of them is an error. An adapter that lists no samples of its own (a MAF track discovering its species from the file) takes the table's rows as its samples |
| <span id="slot-annotationadapter">**annotationAdapter**</span><br>[`maybeFrozen`](/docs/config_guides/slot_types#the-maybe-types) | optional sub-adapter (typically a BigBedAdapter over a UCSC multiz<N>wayFrames.bb) supplying per-species CDS reading frames for the gene-structure overlay and codon view; leave it unset to disable. The display looks this slot up by path off the parent track and is otherwise format-blind, so every MAF adapter takes it the same way |
