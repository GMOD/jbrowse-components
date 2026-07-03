---
id: linearwiggledisplay
title: LinearWiggleDisplay
sidebar_label: Display -> LinearWiggleDisplay
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/LinearWiggleDisplay/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/LinearWiggleDisplay.md)

## Example usage

Minimal `QuantitativeTrack` config. See the
[quantitative track guide](/docs/config_guides/quantitative_track) for all
adapter and display options:

```js
{
  type: 'QuantitativeTrack',
  trackId: 'coverage',
  name: 'Coverage',
  assemblyNames: ['hg38'],
  adapter: { type: 'BigWigAdapter', uri: 'https://example.com/coverage.bw' },
}
```

Taller track, log scale, custom color:

```js
{
  type: 'QuantitativeTrack',
  trackId: 'coverage',
  name: 'Coverage',
  assemblyNames: ['hg38'],
  adapter: { type: 'BigWigAdapter', uri: 'https://example.com/coverage.bw' },
  displayDefaults: {
    height: 200,
    scaleType: 'log',
    color: 'darkgreen',
    useBicolor: false,
  },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

configuration for the wiggle (quantitative/numeric) display showing XY plot,
density, line, or scatter renderings

These are display-level slots: set them inside a track's `displays` to change
its defaults (setting them at the track top level has no effect). The object
shorthand `displayDefaults: { key: value }` is equivalent to the full
`displays: [{ type: 'LinearWiggleDisplay', displayId: '...', key: value }]`
array form — see
[configuring displays](/docs/config_guides/tracks#configuring-displays).

### LinearWiggleDisplay - State model

This config's runtime API is documented on its
[state model page](../../models/linearwiggledisplay).

<details open>
<summary>LinearWiggleDisplay - Slots</summary>

#### slot: defaultRendering

Default rendering type: `xyplot`, `density`, `line`, or `scatter`.

**Type:** `stringEnum` · **Default:** `'xyplot'`

```js
{
  type: 'stringEnum',
  model: types.enumeration('Rendering type', [...WIGGLE_RENDERING_TYPES]),
  defaultValue: 'xyplot',
  description: 'Default rendering type',
}
```

**Example:**

```json
{
  "type": "LinearWiggleDisplay",
  "defaultRendering": "density"
}
```

#### slot: height

Default height of the track

**Type:** `number` · **Default:** `100`

```js
{
  type: 'number',
  defaultValue: 100,
  description: 'Default height of the track',
}
```

#### slot: useBicolor

When true (the default), positive scores use posColor and negative scores use
negColor. When false, all bars use the single color slot.

**Type:** `boolean` · **Default:** `true`

```js
{
  type: 'boolean',
  defaultValue: true,
  description:
    'When true (the default), positive scores use posColor and negative scores use negColor. When false, all bars use the single color slot.',
}
```

#### slot: color

Single fill color for the wiggle bars. Only used when useBicolor is false
(useBicolor defaults to true, in which case posColor/negColor are used instead).

**Type:** `color`

```js
{
  type: 'color',
  defaultValue: WIGGLE_POS_COLOR_DEFAULT,
  description:
    'Single fill color for the wiggle bars. Only used when useBicolor is false (useBicolor defaults to true, in which case posColor/negColor are used instead).',
}
```

#### slot: minimalTicks

Draw only the min/max Y-axis ticks

**Type:** `boolean` · **Default:** `false`

```js
{
  type: 'boolean',
  defaultValue: false,
  description: 'Draw only the min/max Y-axis ticks',
  advanced: true,
}
```

#### slot: summaryScoreMode

choose whether to use max/min/average or whiskers which combines all three into
the same rendering

**Type:** `stringEnum` · **Default:** `'whiskers'`

```js
{
  type: 'stringEnum',
  model: types.enumeration('Score type', ['max', 'min', 'avg', 'whiskers']),
  description:
    'choose whether to use max/min/average or whiskers which combines all three into the same rendering',
  defaultValue: 'whiskers',
}
```

</details>
