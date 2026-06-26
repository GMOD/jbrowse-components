---
id: multiwiggleadapter
title: MultiWiggleAdapter
sidebar_label: Adapter -> MultiWiggleAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/MultiWiggleAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/MultiWiggleAdapter.md)

## Example usage

```js
{
  type: 'MultiQuantitativeTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'MultiWiggleAdapter',
    bigWigs: [
      'https://example.com/sample1.bw',
      'https://example.com/sample2.bw',
    ],
  },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

combines multiple BigWig files into a single multi-row quantitative track

<details open>
<summary>MultiWiggleAdapter - Slots</summary>

#### slot: subadapters

```js
{
  type: 'frozen',
  defaultValue: [],
  description: 'array of subadapter JSON objects',
}
```

#### slot: bigWigs

```js
{
  type: 'frozen',
  description:
    'array of bigwig filenames, alternative to the subadapters slot',
  defaultValue: [],
}
```

</details>
