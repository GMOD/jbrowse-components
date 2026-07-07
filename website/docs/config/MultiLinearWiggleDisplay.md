---
id: multilinearwiggledisplay
title: MultiLinearWiggleDisplay
sidebar_label: Display -> MultiLinearWiggleDisplay
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `wiggle`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/MultiLinearWiggleDisplay/configSchema.ts).

## Example usage

Minimal `MultiQuantitativeTrack` config. See the
[multi-quantitative track guide](/docs/config_guides/multiquantitative_track)
for all adapter and display options:

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
}
```

Taller track overlaying two samples in one shared plot (`multixyplot`) instead
of the default stacked-per-subtrack layout:

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
  displayDefaults: { height: 300, defaultRendering: 'multixyplot' },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

configuration for the multi-wiggle display, which draws several quantitative
subtracks (e.g. BigWig files) on a shared Y axis

These are display-level slots: set them inside a track's `displays` to change
its defaults (setting them at the track top level has no effect). The object
shorthand `displayDefaults: { key: value }` is equivalent to the full
`displays: [{ type: 'MultiLinearWiggleDisplay', displayId: '...', key: value }]`
array form — see
[configuring displays](/docs/config_guides/tracks#configuring-displays).

Per-subtrack metadata (a `name`, `color`, and `group` for each subtrack) is
preloaded on the _adapter_, not here — use `MultiWiggleAdapter`'s `subadapters`
slot, where `group` drives the sidebar clustering tree and `color` sets each
subtrack's line/fill.

| Slot                                         | Type                                   | Description                                                                                                                                                                                                                                                     |
| -------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [height](#slot-height)                       | `number`                               | Default height of the track                                                                                                                                                                                                                                     |
| [summaryScoreMode](#slot-summaryscoremode)   | `stringEnum` (max, min, avg, whiskers) | choose whether to use max/min/average or whiskers which combines all three into the same rendering                                                                                                                                                              |
| [defaultRendering](#slot-defaultrendering)   | `stringEnum`                           | Default rendering type. Multi-row modes (`multirowxy`, `multirowdensity`, `multirowline`, `multirowscatter`) draw one stacked plot per subtrack; overlapping modes (`multixyplot`, `multiline`, `multiscatter`) draw all subtracks together in one shared plot. |
| [minimalTicks](#slot-minimalticks)           | `boolean`                              | Draw only the min/max Y-axis ticks                                                                                                                                                                                                                              |
| [showTree](#slot-showtree)                   | `boolean`                              | Show the subtrack clustering tree in the sidebar                                                                                                                                                                                                                |
| [showBranchLength](#slot-showbranchlength)   | `boolean`                              | Draw the clustering tree with branch lengths                                                                                                                                                                                                                    |
| [showRowSeparators](#slot-showrowseparators) | `boolean`                              | Draw separator lines between subtrack rows                                                                                                                                                                                                                      |

<details>
<summary>MultiLinearWiggleDisplay - Slots</summary>

#### slot: height

Default height of the track

**Type:** `number` · **Default:** `200`

#### slot: summaryScoreMode

choose whether to use max/min/average or whiskers which combines all three into
the same rendering

**Type:** `stringEnum` (one of `max`, `min`, `avg`, `whiskers`) · **Default:**
`'avg'`

#### slot: defaultRendering

Default rendering type. Multi-row modes (`multirowxy`, `multirowdensity`,
`multirowline`, `multirowscatter`) draw one stacked plot per subtrack;
overlapping modes (`multixyplot`, `multiline`, `multiscatter`) draw all
subtracks together in one shared plot.

**Type:** `stringEnum` · **Default:** `'multirowxy'`

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

#### slot: minimalTicks

Draw only the min/max Y-axis ticks

**Type:** `boolean` · **Default:** `false` · _advanced_

#### slot: showTree

Show the subtrack clustering tree in the sidebar

**Type:** `boolean` · **Default:** `true`

#### slot: showBranchLength

Draw the clustering tree with branch lengths

**Type:** `boolean` · **Default:** `false`

#### slot: showRowSeparators

Draw separator lines between subtrack rows

**Type:** `boolean` · **Default:** `false`

</details>

## Related links

- **Adapter:** [MultiWiggleAdapter](../multiwiggleadapter)
- **State model:** [runtime API](../../models/multilinearwiggledisplay)
