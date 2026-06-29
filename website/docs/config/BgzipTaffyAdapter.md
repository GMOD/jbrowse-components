---
id: bgziptaffyadapter
title: BgzipTaffyAdapter
sidebar_label: Adapter -> BgzipTaffyAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/maf/src/BgzipTaffyAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/BgzipTaffyAdapter.md)

## Overview

used to configure BgzipTaffy adapter

<details open>
<summary>BgzipTaffyAdapter - Slots</summary>

#### slot: samples

string[] or {id:string,label:string,color?:string}[]

**Type:** `frozen`

```js
{
  type: 'frozen',
  description: 'string[] or {id:string,label:string,color?:string}[]',
  defaultValue: [],
}
```

#### slot: tafGzLocation

bgzip taffy file

**Type:** `fileLocation`

```js
{
  type: 'fileLocation',
  description: 'bgzip taffy file',
  defaultValue: {
    uri: '/path/to/my.taf.gz',
    locationType: 'UriLocation',
  },
}
```

#### slot: taiLocation

taffy index

**Type:** `fileLocation`

```js
{
  type: 'fileLocation',
  description: 'taffy index',
  defaultValue: {
    uri: '/path/to/my.taf.gz.tai',
    locationType: 'UriLocation',
  },
}
```

#### slot: nhLocation

newick tree

**Type:** `fileLocation`

```js
{
  type: 'fileLocation',
  description: 'newick tree',
  defaultValue: {
    uri: '/path/to/my.nh',
    locationType: 'UriLocation',
  },
}
```

#### slot: annotationAdapter

optional sub-adapter (typically a BigBedAdapter over a UCSC
multiz<N>wayFrames.bb) supplying per-species CDS reading frames for the
gene-structure overlay and codon view; null disables it

**Type:** `frozen`

```js
{
  type: 'frozen',
  description:
    'optional sub-adapter (typically a BigBedAdapter over a UCSC multiz<N>wayFrames.bb) supplying per-species CDS reading frames for the gene-structure overlay and codon view; null disables it',
  defaultValue: null,
}
```

</details>
