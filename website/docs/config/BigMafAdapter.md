---
id: bigmafadapter
title: BigMafAdapter
sidebar_label: Adapter -> BigMafAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `maf` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/maf/src/BigMafAdapter/configSchema.ts).

## Overview

used to configure BigMaf adapter

| Slot                                         | Type           | Description                                                                                                                                                                                 |
| -------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [samples](#slot-samples)                     | `frozen`       | string[] or {id:string,label:string,color?:string}[]                                                                                                                                        |
| [bigBedLocation](#slot-bigbedlocation)       | `fileLocation` |                                                                                                                                                                                             |
| [nhLocation](#slot-nhlocation)               | `fileLocation` | newick tree                                                                                                                                                                                 |
| [summaryAdapter](#slot-summaryadapter)       | `frozen`       | optional swappable sub-adapter (e.g. a BigBedAdapter over UCSC bigMafSummary.bb) used for cheap zoom-out rendering; null disables it                                                        |
| [annotationAdapter](#slot-annotationadapter) | `frozen`       | optional sub-adapter (typically a BigBedAdapter over a UCSC multiz<N>wayFrames.bb) supplying per-species CDS reading frames for the gene-structure overlay and codon view; null disables it |

<details>
<summary>BigMafAdapter - Slots</summary>

#### slot: samples

string[] or {id:string,label:string,color?:string}[]

**Type:** `frozen` · **Default:** `[]`

#### slot: bigBedLocation

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/my.bb', locationType: 'UriLocation' }`

#### slot: nhLocation

newick tree

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/my.nh', locationType: 'UriLocation' }`

#### slot: summaryAdapter

optional swappable sub-adapter (e.g. a BigBedAdapter over UCSC bigMafSummary.bb)
used for cheap zoom-out rendering; null disables it

**Type:** `frozen` · **Default:** `null`

#### slot: annotationAdapter

optional sub-adapter (typically a BigBedAdapter over a UCSC
multiz<N>wayFrames.bb) supplying per-species CDS reading frames for the
gene-structure overlay and codon view; null disables it

**Type:** `frozen` · **Default:** `null`

</details>
