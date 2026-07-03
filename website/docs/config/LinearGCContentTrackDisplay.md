---
id: lineargccontenttrackdisplay
title: LinearGCContentTrackDisplay
sidebar_label: Display -> LinearGCContentTrackDisplay
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gccontent/src/LinearGCContentDisplay/config2.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/LinearGCContentTrackDisplay.md)

## Example usage

A standalone `GCContentTrack` whose `GCContentAdapter` wraps a sequence adapter
(use this instead of the `ReferenceSequenceTrack` display when you want GC as
its own track):

```js
{
  type: 'GCContentTrack',
  trackId: 'gc',
  name: 'GC content',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'GCContentAdapter',
    sequenceAdapter: {
      type: 'IndexedFastaAdapter',
      fastaLocation: { uri: 'https://example.com/genome.fa' },
      faiLocation: { uri: 'https://example.com/genome.fa.fai' },
    },
  },
}
```

GC-skew mode with overlapping windows for a smoother signal. The
`displayDefaults` object shorthand applies settings to whichever display uses
them — equivalent to a full `displays: [{ type, displayId, ... }]` array. See
[configuring displays](/docs/config_guides/tracks#configuring-displays):

```js
{
  type: 'GCContentTrack',
  trackId: 'gc',
  name: 'GC skew',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'GCContentAdapter',
    sequenceAdapter: {
      type: 'IndexedFastaAdapter',
      fastaLocation: { uri: 'https://example.com/genome.fa' },
      faiLocation: { uri: 'https://example.com/genome.fa.fai' },
    },
  },
  displayDefaults: { gcMode: 'skew', windowSize: 50, windowDelta: 10 },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

used specifically for GCContentTrack

### LinearGCContentTrackDisplay - State model

This config's runtime API is documented on its
[state model page](../../models/lineargccontenttrackdisplay).

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

### LinearGCContentTrackDisplay - Derives from

- [LinearWiggleDisplay](../linearwiggledisplay)

```js
baseConfiguration: pluginManager.getDisplayType('LinearWiggleDisplay')
  .configSchema
```
