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

A complete `QuantitativeTrack` config to paste into `tracks`. `height` is the
common display-level override; score-range and rendering options (autoscale,
min/max score, renderer) are config slots on the track itself — see the
`QuantitativeTrack` config:

```js
{
  type: 'QuantitativeTrack',
  trackId: 'coverage',
  name: 'Coverage',
  assemblyNames: ['hg38'],
  adapter: { type: 'BigWigAdapter', uri: 'https://example.com/coverage.bw' },
  displays: [
    {
      type: 'LinearWiggleDisplay',
      displayId: 'coverage-LinearWiggleDisplay',
      height: 100,
    },
  ],
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

configuration for the wiggle (quantitative/numeric) display showing XY plot,
density, line, or scatter renderings

These are display-level slots: set them inside a track's `displays` array to
change its defaults (setting them at the track top level has no effect).

```json
{
  "type": "QuantitativeTrack",
  "trackId": "my_wiggle_track",
  "name": "My Wiggle Track",
  "assemblyNames": ["hg19"],
  "adapter": { "type": "BigWigAdapter", "uri": "http://yourhost/file.bw" },
  "displays": [
    {
      "type": "LinearWiggleDisplay",
      "scaleType": "log",
      "autoscale": "global"
    }
  ]
}
```

<details open>
<summary>LinearWiggleDisplay - Slots</summary>

#### slot: defaultRendering

Default rendering type: `xyplot`, `density`, `line`, or `scatter`.

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

```js
{
  type: 'number',
  defaultValue: 100,
  description: 'Default height of the track',
}
```

#### slot: useBicolor

```js
{
  type: 'boolean',
  defaultValue: true,
  description:
    'Use separate positive/negative colors instead of a single color',
}
```

#### slot: color

```js
{
  type: 'color',
  defaultValue: WIGGLE_POS_COLOR_DEFAULT,
  description: 'Color for the wiggle bars (when not using bicolor mode)',
}
```

#### slot: summaryScoreMode

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
