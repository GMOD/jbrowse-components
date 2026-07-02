---
id: linearmanhattandisplay
title: LinearManhattanDisplay
sidebar_label: Display -> LinearManhattanDisplay
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gwas/src/LinearManhattanDisplay/configSchemaFactory.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/LinearManhattanDisplay.md)

## Example usage

Minimal `GWASTrack` config. See the
[GWAS track guide](/docs/config_guides/gwas_track) for all options:

```js
{
  type: 'GWASTrack',
  trackId: 'gwas',
  name: 'GWAS results',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'GWASAdapter',
    uri: 'https://example.com/gwas.bed.gz',
  },
}
```

Taller track, LocusZoom-style coloring: `colorBy: 'ld'` colors each point by its
r² to the index SNP read from `ldAdapter`. The `displayDefaults` object
shorthand is equivalent to
`displays: [{ type: 'LinearManhattanDisplay', displayId: '...', ... }]` — see
[configuring displays](/docs/config_guides/tracks#configuring-displays):

```js
{
  type: 'GWASTrack',
  trackId: 'gwas',
  name: 'GWAS results',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'GWASAdapter',
    uri: 'https://example.com/gwas.bed.gz',
  },
  displayDefaults: {
    height: 400,
    colorBy: 'ld',
    ldAdapter: {
      type: 'PlinkLDTabixAdapter',
      uri: 'https://example.com/plink.ld.gz',
    },
  },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

configuration for the Manhattan plot display used by GWAS tracks

### LinearManhattanDisplay - State model

This config's runtime API is documented on its
[state model page](../../models/linearmanhattandisplay).

<details open>
<summary>LinearManhattanDisplay - Slots</summary>

#### slot: color

CSS color or jexl callback for Manhattan points

**Type:** `color` · **Default:** `'#0068d1'`

```js
{
  type: 'color',
  defaultValue: '#0068d1',
  description: 'CSS color or jexl callback for Manhattan points',
}
```

#### slot: colorBy

LocusZoom-style coloring. 'normal' uses `color`; 'ld' colors each point by its
r² to the index SNP, read from `ldAdapter`.

**Type:** `stringEnum` · **Default:** `'normal'`

```js
{
  type: 'stringEnum',
  model: types.enumeration('GwasColorBy', ['normal', 'ld']),
  defaultValue: 'normal',
  description: 'How to color Manhattan points',
}
```

#### slot: ldAdapter

PLINK .ld adapter (PlinkLDAdapter / PlinkLDTabixAdapter) supplying pairwise r²
used when colorBy is 'ld'.

**Type:** `frozen`

```js
{
  type: 'frozen',
  defaultValue: null,
  description: 'Adapter config for PLINK .ld pairwise r² data',
}
```

</details>

## Inherited config slots

Slots available on this config via its base configuration(s), shown in full so
this page is self-contained.

<details open>
<summary>Inherited from LinearWiggleDisplay</summary>

[LinearWiggleDisplay config →](../linearwiggledisplay)

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

Use separate positive/negative colors instead of a single color

**Type:** `boolean` · **Default:** `true`

```js
{
  type: 'boolean',
  defaultValue: true,
  description:
    'Use separate positive/negative colors instead of a single color',
}
```

#### slot: color

Color for the wiggle bars (when not using bicolor mode)

**Type:** `color`

```js
{
  type: 'color',
  defaultValue: WIGGLE_POS_COLOR_DEFAULT,
  description: 'Color for the wiggle bars (when not using bicolor mode)',
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

### LinearManhattanDisplay - Derives from

- [LinearWiggleDisplay](../linearwiggledisplay)

```js
baseConfiguration: linearWiggleDisplayConfigSchema
```
