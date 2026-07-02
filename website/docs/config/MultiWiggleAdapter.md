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

The `bigWigs` shorthand: a plain array of BigWig URLs, one subtrack each (the
subtrack name is derived from the filename):

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

Preloading per-subtrack metadata: use `subadapters` instead of `bigWigs` to
attach a `name`, a `color`, and a `group` to each subtrack. The extra keys ride
along as source metadata — `group` drives the sidebar clustering tree and
`color` sets the subtrack's line/fill on load:

```js
{
  type: 'MultiQuantitativeTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'MultiWiggleAdapter',
    subadapters: [
      {
        type: 'BigWigAdapter',
        name: 'Alpha',
        group: 'Islet',
        color: '#e6194b',
        bigWigLocation: { uri: 'https://example.com/alpha.bw' },
      },
      {
        type: 'BigWigAdapter',
        name: 'Beta',
        group: 'Islet',
        color: '#f58231',
        bigWigLocation: { uri: 'https://example.com/beta.bw' },
      },
    ],
  },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

combines multiple BigWig files into a single multi-row quantitative track

### Used in

This adapter supplies data to the
[MultiQuantitativeTrack](../multiquantitativetrack) track type.

<details open>
<summary>MultiWiggleAdapter - Slots</summary>

#### slot: subadapters

array of subadapter JSON objects

**Type:** `frozen`

```js
{
  type: 'frozen',
  defaultValue: [],
  description: 'array of subadapter JSON objects',
}
```

#### slot: bigWigs

array of bigwig filenames, alternative to the subadapters slot

**Type:** `frozen`

```js
{
  type: 'frozen',
  description:
    'array of bigwig filenames, alternative to the subadapters slot',
  defaultValue: [],
}
```

</details>
