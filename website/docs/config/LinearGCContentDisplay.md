---
id: lineargccontentdisplay
title: LinearGCContentDisplay
sidebar_label: Display -> LinearGCContentDisplay
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gccontent/src/LinearGCContentDisplay/config1.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/LinearGCContentDisplay.md)

## Example usage

This display attaches to a `ReferenceSequenceTrack` — it derives GC from the
track's own sequence adapter, so no extra adapter is needed. `gcMode` is
`content` or `skew`:

```js
{
  type: 'ReferenceSequenceTrack',
  trackId: 'refseq',
  name: 'Reference sequence',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'IndexedFastaAdapter',
    uri: 'https://example.com/genome.fa',
  },
  displays: [
    {
      type: 'LinearGCContentDisplay',
      displayId: 'refseq-LinearGCContentDisplay',
      windowSize: 100,
      windowDelta: 100,
      gcMode: 'content',
    },
  ],
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

### LinearGCContentDisplay - State model

This config's runtime API is documented on its
[state model page](../../models/lineargccontentdisplay).

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

### LinearGCContentDisplay - Derives from

- [LinearWiggleDisplay](../linearwiggledisplay)

```js
baseConfiguration: pluginManager.getDisplayType('LinearWiggleDisplay')
  .configSchema
```
