---
id: bgziptaffyadapter
title: BgzipTaffyAdapter
sidebar_label: Adapter -> BgzipTaffyAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `maf` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/maf/src/BgzipTaffyAdapter/configSchema.ts).

used to configure BgzipTaffy adapter

## Related links

- **Track:** [MafTrack](../maftrack)
- **Display:** [LinearMafDisplay](../linearmafdisplay)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                         | Type           | Description                                                                                                                                                                                 |
| -------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [samples](#slot-samples)                     | `frozen`       | string[] or {id:string,label:string,color?:string}[]                                                                                                                                        |
| [tafGzLocation](#slot-tafgzlocation)         | `fileLocation` | bgzip taffy file                                                                                                                                                                            |
| [taiLocation](#slot-tailocation)             | `fileLocation` | taffy index                                                                                                                                                                                 |
| [nhLocation](#slot-nhlocation)               | `fileLocation` | newick tree                                                                                                                                                                                 |
| [annotationAdapter](#slot-annotationadapter) | `frozen`       | optional sub-adapter (typically a BigBedAdapter over a UCSC multiz<N>wayFrames.bb) supplying per-species CDS reading frames for the gene-structure overlay and codon view; null disables it |

<details>
<summary>BgzipTaffyAdapter - Slots</summary>

#### slot: samples

string[] or {id:string,label:string,color?:string}[]

**Type:** [`frozen`](/docs/config_guides/slot_types#frozen) · **Default:** `[]`

#### slot: tafGzLocation

bgzip taffy file

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: '/path/to/my.taf.gz', locationType: 'UriLocation' }`

#### slot: taiLocation

taffy index

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: '/path/to/my.taf.gz.tai', locationType: 'UriLocation' }`

#### slot: nhLocation

newick tree

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: '/path/to/my.nh', locationType: 'UriLocation' }`

#### slot: annotationAdapter

optional sub-adapter (typically a BigBedAdapter over a UCSC
multiz<N>wayFrames.bb) supplying per-species CDS reading frames for the
gene-structure overlay and codon view; null disables it

**Type:** [`frozen`](/docs/config_guides/slot_types#frozen) · **Default:**
`null`

</details>
