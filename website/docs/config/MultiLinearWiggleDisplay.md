---
id: multilinearwiggledisplay
title: MultiLinearWiggleDisplay
sidebar_label: Display -> MultiLinearWiggleDisplay
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/MultiLinearWiggleDisplay/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/MultiLinearWiggleDisplay.md)

## Example usage

A complete `MultiQuantitativeTrack` config to paste into `tracks`, overlaying
two samples in one shared plot (`multixyplot`) instead of the default
stacked-per-subtrack layout:

```js
{
  type: 'MultiQuantitativeTrack',
  trackId: 'coverage_by_sample',
  name: 'Coverage by sample',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'MultiWiggleAdapter',
    bigWigs: [
      'https://example.com/sample1.bw',
      'https://example.com/sample2.bw',
    ],
  },
  displays: [
    {
      type: 'MultiLinearWiggleDisplay',
      displayId: 'coverage_by_sample-MultiLinearWiggleDisplay',
      defaultRendering: 'multixyplot',
    },
  ],
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

configuration for the multi-wiggle display, which draws several quantitative
subtracks (e.g. BigWig files) on a shared Y axis

These are display-level slots: set them inside a track's `displays` array to
change its defaults (setting them at the track top level has no effect).

```json
{
  "type": "MultiQuantitativeTrack",
  "trackId": "my_multiwig_track",
  "name": "My MultiWig Track",
  "assemblyNames": ["hg19"],
  "adapter": { "type": "MultiWiggleAdapter", "subadapters": [] },
  "displays": [
    {
      "type": "MultiLinearWiggleDisplay",
      "defaultRendering": "multirowxy",
      "autoscale": "globalsd"
    }
  ]
}
```

<details open>
<summary>MultiLinearWiggleDisplay - Slots</summary>

#### slot: height

```js
{
  type: 'number',
  defaultValue: 200,
  description: 'Default height of the track',
}
```

#### slot: summaryScoreMode

```js
{
  type: 'stringEnum',
  model: types.enumeration('Score type', ['max', 'min', 'avg', 'whiskers']),
  description:
    'choose whether to use max/min/average or whiskers which combines all three into the same rendering',
  defaultValue: 'avg',
}
```

#### slot: defaultRendering

Default rendering type. Multi-row modes (`multirowxy`, `multirowdensity`,
`multirowline`, `multirowscatter`) draw one stacked plot per subtrack;
overlapping modes (`multixyplot`, `multiline`, `multiscatter`) draw all
subtracks together in one shared plot.

```js
{
  type: 'stringEnum',
  model: types.enumeration('Rendering', [...MULTI_WIGGLE_RENDERING_TYPES]),
  defaultValue: 'multirowxy',
  description: 'Default rendering type',
}
```

**Example:**

```json
{
  "type": "MultiLinearWiggleDisplay",
  "defaultRendering": "multixyplot"
}
```

</details>
