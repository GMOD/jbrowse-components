---
id: maftabixadapter
title: MafTabixAdapter
sidebar_label: Adapter -> MafTabixAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `maf` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/maf/src/MafTabixAdapter/configSchema.ts).

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

These slots go inside the track's `adapter`:
`"adapter": { "type": "MafTabixAdapter", ... }`. It also accepts the
[shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`,
`baseUri`, `csi`, `nhUri` in place of writing a location slot out. Slot types
(`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types). Slots a base
configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-samples">**samples**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>[]</code> | string[] or {id:string,label:string,color?:string,assemblyName?:string,assemblyConfigLocation?:UriLocation}[]; assemblyName makes rows for that sample navigable to its own genome, and assemblyConfigLocation says where to load that assembly from when the session lacks it |
| <span id="slot-bedgzlocation">**bedGzLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.bed.gz', locationType: 'UriLocation' }</code> |  |
| <span id="slot-refassemblyname">**refAssemblyName**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> |  |
| <span id="slot-indexlocation">**index.location**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.bed.gz.tbi' }</code> |  |
| <span id="slot-indexindextype">**index.indexType**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (TBI, CSI) = <code>'TBI'</code> |  |
| <span id="slot-nhlocation">**nhLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.nh', locationType: 'UriLocation' }</code> | newick tree |
| <span id="slot-summaryadapter">**summaryAdapter**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>null</code> | The zoom-out tier. A tabix MAF carries every species' bases on one line, so a wide read downloads the whole alignment and the byte gate blocks it; without this slot the track simply has no zoom-out path. Point it at a `BedTabixAdapter` over the summary BED `maf2bed --summary` writes (one merged run per species, no sequence), or at a `BigBedAdapter` over a UCSC `bigMafSummary.bb` covering the same alignment. |
| <span id="slot-annotationadapter">**annotationAdapter**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>null</code> | optional sub-adapter (typically a BigBedAdapter over a UCSC multiz<N>wayFrames.bb) supplying per-species CDS reading frames for the gene-structure overlay and codon view; null disables it |
