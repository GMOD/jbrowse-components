---
id: bgziptaffyadapter
title: BgzipTaffyAdapter
sidebar_label: Adapter -> BgzipTaffyAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `maf` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/maf/src/BgzipTaffyAdapter/configSchema.ts).

## Overview

used to configure BgzipTaffy adapter

<details open>
<summary>BgzipTaffyAdapter - Slots</summary>

#### slot: samples

string[] or {id:string,label:string,color?:string}[]

**Type:** `frozen` · **Default:** `[]`

#### slot: tafGzLocation

bgzip taffy file

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/my.taf.gz', locationType: 'UriLocation' }`

#### slot: taiLocation

taffy index

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/my.taf.gz.tai', locationType: 'UriLocation' }`

#### slot: nhLocation

newick tree

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/my.nh', locationType: 'UriLocation' }`

#### slot: annotationAdapter

optional sub-adapter (typically a BigBedAdapter over a UCSC
multiz<N>wayFrames.bb) supplying per-species CDS reading frames for the
gene-structure overlay and codon view; null disables it

**Type:** `frozen` · **Default:** `null`

</details>
