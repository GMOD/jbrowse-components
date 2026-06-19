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

```js
{
  type: 'frozen',
  description: 'string[] or {id:string,label:string,color?:string}[]',
  defaultValue: [],
}
```

#### slot: tafGzLocation

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

</details>
