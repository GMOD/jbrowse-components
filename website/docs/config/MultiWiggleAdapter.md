---
id: multiwiggleadapter
title: MultiWiggleAdapter
sidebar_label: Adapter -> MultiWiggleAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `wiggle`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/MultiWiggleAdapter/configSchema.ts).

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

| Slot                             | Type     | Description                                                     |
| -------------------------------- | -------- | --------------------------------------------------------------- |
| [subadapters](#slot-subadapters) | `frozen` | array of subadapter JSON objects                                |
| [bigWigs](#slot-bigwigs)         | `frozen` | array of BigWig URLs/paths, alternative to the subadapters slot |

<details>
<summary>MultiWiggleAdapter - Slots</summary>

#### slot: subadapters

array of subadapter JSON objects

**Type:** `frozen` · **Default:** `[]`

#### slot: bigWigs

array of BigWig URLs/paths, alternative to the subadapters slot

**Type:** `frozen` · **Default:** `[]`

</details>

## Related links

- **Track:** [MultiQuantitativeTrack](../multiquantitativetrack)
- **Display:** [MultiLinearWiggleDisplay](../multilinearwiggledisplay)
