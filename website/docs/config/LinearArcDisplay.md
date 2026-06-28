---
id: lineararcdisplay
title: LinearArcDisplay
sidebar_label: Display -> LinearArcDisplay
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/arc/src/LinearArcDisplay/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/LinearArcDisplay.md)

## Example usage

Selected on a `FeatureTrack`; each feature is drawn as an arc from its start to
its end. `displayMode` is `arcs` or `semicircles`:

```js
{
  type: 'FeatureTrack',
  trackId: 'interactions',
  name: 'Interactions',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'Gff3TabixAdapter',
    uri: 'https://example.com/interactions.gff3.gz',
  },
  displays: [
    {
      type: 'LinearArcDisplay',
      displayId: 'interactions-LinearArcDisplay',
      displayMode: 'semicircles',
    },
  ],
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

### LinearArcDisplay - State model

This config's runtime API is documented on its
[state model page](../../models/lineararcdisplay).

<details open>
<summary>LinearArcDisplay - Slots</summary>

#### slot: color

the color of the arcs

**Type:** `color` · **Default:** `'darkblue'`

```js
{
  type: 'color',
  description: 'the color of the arcs',
  defaultValue: 'darkblue',
  contextVariable: ['feature'],
}
```

#### slot: thickness

the thickness of the arcs

**Type:** `number` · **Default:** `'jexl:logThickness(feature,'score')'`

```js
{
  type: 'number',
  description: 'the thickness of the arcs',
  defaultValue: `jexl:logThickness(feature,'score')`,
  contextVariable: ['feature'],
}
```

#### slot: label

the label to appear at the apex of the arcs

**Type:** `string` · **Default:** `'jexl:get(feature,'score')'`

```js
{
  type: 'string',
  description: 'the label to appear at the apex of the arcs',
  defaultValue: `jexl:get(feature,'score')`,
  contextVariable: ['feature'],
}
```

#### slot: arcHeight

the height of the arcs

**Type:** `number` · **Default:**
`'jexl:log10(get(feature,'end')-get(feature,'start'))*50'`

```js
{
  type: 'number',
  description: 'the height of the arcs',
  defaultValue: `jexl:log10(get(feature,'end')-get(feature,'start'))*50`,
  contextVariable: ['feature'],
}
```

#### slot: caption

the caption to appear when hovering over any point on the arcs

**Type:** `string` · **Default:** `'jexl:get(feature,'name')'`

```js
{
  type: 'string',
  description:
    'the caption to appear when hovering over any point on the arcs',
  defaultValue: `jexl:get(feature,'name')`,
  contextVariable: ['feature'],
}
```

#### slot: displayMode

render semi-circles instead of arcs

**Type:** `enum` · **Default:** `'arcs'`

```js
{
  type: 'enum',
  defaultValue: 'arcs',
  model: types.enumeration('DisplayMode', ['arcs', 'semicircles']),
  description: 'render semi-circles instead of arcs',
}
```

</details>

## Inherited config slots

Slots available on this config via its base configuration(s), shown in full so
this page is self-contained.

<details open>
<summary>Inherited from BaseLinearDisplay</summary>

[BaseLinearDisplay config →](../baselineardisplay)

#### slot: maxFeatureScreenDensity

maximum features per pixel before showing a "too many features" message, used if
byte size estimates are not available

**Type:** `number` · **Default:** `1`

```js
{
  type: 'number',
  description:
    'maximum features per pixel before showing a "too many features" message, used if byte size estimates are not available',
  defaultValue: 1,
  advanced: true,
}
```

#### slot: fetchSizeLimit

maximum data to attempt to download for a given track, used if adapter doesn't
specify one

**Type:** `number` · **Default:** `1_000_000`

```js
{
  type: 'number',
  defaultValue: 1_000_000,
  description:
    "maximum data to attempt to download for a given track, used if adapter doesn't specify one",
  advanced: true,
}
```

#### slot: height

default height for the track

**Type:** `number` · **Default:** `100`

```js
{
  type: 'number',
  defaultValue: 100,
  description: 'default height for the track',
}
```

#### slot: mouseover

text to display when the cursor hovers over a feature

**Type:** `string` · **Default:**
`'jexl:mouseoverExtraInformation||get(feature,'_mouseOver')||get(feature,'name')||get(feature,'id')'`

```js
{
  type: 'string',
  description: 'text to display when the cursor hovers over a feature',
  defaultValue: `jexl:mouseoverExtraInformation||get(feature,'_mouseOver')||get(feature,'name')||get(feature,'id')`,
  contextVariable: ['feature', 'mouseoverExtraInformation'],
}
```

#### slot: jexlFilters

config jexlFilters are deferred evaluated so they are prepended with jexl at
runtime rather than being stored with jexl in the config

**Type:** `stringArray`

```js
{
  type: 'stringArray',
  description:
    'default set of jexl filters to apply to a track. note: these do not use the jexl prefix because they have a deferred evaluation system',
  defaultValue: [],
}
```

</details>

### LinearArcDisplay - Derives from

- [BaseLinearDisplay](../baselineardisplay)

```js
baseConfiguration: baseLinearDisplayConfigSchema
```
