---
id: lineararcdisplay
title: LinearArcDisplay
sidebar_label: Display -> LinearArcDisplay
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `arc` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/arc/src/LinearArcDisplay/configSchema.ts).

## Example usage

Selected on a `FeatureTrack`; each feature is drawn as one arc from its start to
its end. `displayMode` is `arcs` (bezier) or `semicircles`. The `thickness` and
`label` slots default to expressions over the feature `score`, so override them
(plus `color` / `arcHeight`) for data without a score. All style slots are
jexl-evaluated per feature:

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
      color: "jexl:get(feature,'strand')==-1?'red':'blue'",
      arcHeight: 80,
      label: "jexl:get(feature,'name')",
    },
  ],
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

### LinearArcDisplay - Compatible adapters

Data adapters that can supply the [FeatureTrack](../featuretrack):

- [BedAdapter](../bedadapter)
- [BedTabixAdapter](../bedtabixadapter)
- [BigBedAdapter](../bigbedadapter)
- [Gff3Adapter](../gff3adapter)
- [Gff3TabixAdapter](../gff3tabixadapter)
- [GtfAdapter](../gtfadapter)
- [GtfTabixAdapter](../gtftabixadapter)

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

**Type:** `enum` (one of `arcs`, `semicircles`) · **Default:** `'arcs'`

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

**Type:** `number` · **Default:** `1` · _advanced_

#### slot: fetchSizeLimit

maximum data to attempt to download for a given track, used if adapter doesn't
specify one

**Type:** `number` · **Default:** `1_000_000` · _advanced_

#### slot: height

default height for the track

**Type:** `number` · **Default:** `100`

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

**Type:** `stringArray` · **Default:** `[]`

</details>

### LinearArcDisplay - Derives from

- [BaseLinearDisplay](../baselineardisplay)
