---
id: bigmafadapter
title: BigMafAdapter
sidebar_label: Adapter -> BigMafAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/maf/src/BigMafAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/BigMafAdapter.md)

## Overview

used to configure BigMaf adapter

<details open>
<summary>BigMafAdapter - Slots</summary>

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

#### slot: bigBedLocation

**Type:** `fileLocation`

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: '/path/to/my.bb',
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

#### slot: summaryAdapter

optional swappable sub-adapter (e.g. a BigBedAdapter over UCSC bigMafSummary.bb)
used for cheap zoom-out rendering; null disables it

**Type:** `frozen`

```js
{
  type: 'frozen',
  description:
    'optional swappable sub-adapter (e.g. a BigBedAdapter over UCSC bigMafSummary.bb) used for cheap zoom-out rendering; null disables it',
  defaultValue: null,
}
```

</details>
