---
id: linearwiggledisplay
title: LinearWiggleDisplay
---

Note: this document is automatically generated from configuration objects in
our source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/LinearWiggleDisplay/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/LinearWiggleDisplay.md)

## Overview

configuration for the wiggle (quantitative/numeric) display showing XY plot, density, line, or scatter renderings

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

### LinearWiggleDisplay - Slots

#### slot: defaultRendering

Default rendering type: `xyplot`, `density`, `line`, or `scatter`.

```js
defaultRendering: {
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
height: {
      type: 'number',
      defaultValue: 100,
      description: 'Default height of the track',
    }
```
#### slot: useBicolor

```js
useBicolor: {
      type: 'boolean',
      defaultValue: true,
      description:
        'Use separate positive/negative colors instead of a single color',
    }
```
#### slot: color

```js
color: {
      type: 'color',
      defaultValue: WIGGLE_POS_COLOR_DEFAULT,
      description: 'Color for the wiggle bars (when not using bicolor mode)',
    }
```
#### slot: summaryScoreMode

```js
summaryScoreMode: {
      type: 'stringEnum',
      model: types.enumeration('Score type', ['max', 'min', 'avg', 'whiskers']),
      description:
        'choose whether to use max/min/average or whiskers which combines all three into the same rendering',
      defaultValue: 'whiskers',
    }
```
