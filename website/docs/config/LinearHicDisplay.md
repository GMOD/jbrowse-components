---
id: linearhicdisplay
title: LinearHicDisplay
sidebar_label: Display -> LinearHicDisplay
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `hic` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/hic/src/LinearHicDisplay/configSchema.ts).

## Example usage

A minimal `HicTrack` config. See the
[Hi-C track guide](/docs/config_guides/hic_track) for all options:

```js
{
  type: 'HicTrack',
  trackId: 'hic',
  name: 'Hi-C',
  assemblyNames: ['hg38'],
  adapter: { type: 'HicAdapter', uri: 'https://example.com/contacts.hic' },
}
```

With log scale and a coarser resolution (`resolutionBias` nudges the auto-picked
binsize; negative = finer, positive = coarser). The `displayDefaults` object
shorthand applies settings to whichever display uses them — equivalent to a full
`displays: [{ type, displayId, ... }]` array. See
[configuring displays](/docs/config_guides/tracks#configuring-displays):

```js
{
  type: 'HicTrack',
  trackId: 'hic',
  name: 'Hi-C',
  assemblyNames: ['hg38'],
  adapter: { type: 'HicAdapter', uri: 'https://example.com/contacts.hic' },
  displayDefaults: { useLogScale: true, resolutionBias: 1 },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

| Slot                                                   | Type                                   | Description                                                                                                                                                                                                            |
| ------------------------------------------------------ | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [height](#slot-height)                                 | `number`                               | default height for the Hi-C track                                                                                                                                                                                      |
| [colorScheme](#slot-colorscheme)                       | `stringEnum` (fall, juicebox, viridis) | color ramp used to render contact intensity                                                                                                                                                                            |
| [showLegend](#slot-showlegend)                         | `boolean`                              | show the color scale legend                                                                                                                                                                                            |
| [resolutionBias](#slot-resolutionbias)                 | `number`                               | Signed integer offset from the zoom-derived auto-picked binsize. `0` means pure auto; `-1` is one step finer, `+1` one step coarser. Tracking the offset (not an absolute binsize) keeps the intent valid across zoom. |
| [useLogScale](#slot-uselogscale)                       | `boolean`                              | map contact counts to color on a log2 scale                                                                                                                                                                            |
| [useColorPercentile](#slot-usecolorpercentile)         | `boolean`                              | false → maxScore/20 (linear) or maxScore (log); true → 95th percentile of counts, so off-diagonal contacts read more strongly.                                                                                         |
| [showResolutionControls](#slot-showresolutioncontrols) | `boolean`                              | show the on-canvas resolution stepper overlay                                                                                                                                                                          |
| [selectedNormalization](#slot-selectednormalization)   | `string`                               | The user's chosen matrix normalization scheme (e.g. KR, SCALE, VC, NONE). Resolved at runtime against what the `.hic` file actually provides — see the model's `activeNormalization` getter.                           |
| [fitToHeight](#slot-fittoheight)                       | `boolean`                              | squash the triangle vertically to fit the display height instead of drawing square bins                                                                                                                                |

<details>
<summary>LinearHicDisplay - Slots</summary>

#### slot: height

default height for the Hi-C track

**Type:** `number` · **Default:** `300`

#### slot: colorScheme

color ramp used to render contact intensity

**Type:** `stringEnum` (one of `fall`, `juicebox`, `viridis`) · **Default:**
`'juicebox'`

#### slot: showLegend

show the color scale legend

**Type:** `boolean` · **Default:** `false`

#### slot: resolutionBias

Signed integer offset from the zoom-derived auto-picked binsize. `0` means pure
auto; `-1` is one step finer, `+1` one step coarser. Tracking the offset (not an
absolute binsize) keeps the intent valid across zoom.

**Type:** `number` · **Default:** `0`

#### slot: useLogScale

map contact counts to color on a log2 scale

**Type:** `boolean` · **Default:** `false`

#### slot: useColorPercentile

false → maxScore/20 (linear) or maxScore (log); true → 95th percentile of
counts, so off-diagonal contacts read more strongly.

**Type:** `boolean` · **Default:** `false`

#### slot: showResolutionControls

show the on-canvas resolution stepper overlay

**Type:** `boolean` · **Default:** `true`

#### slot: selectedNormalization

The user's chosen matrix normalization scheme (e.g. KR, SCALE, VC, NONE).
Resolved at runtime against what the `.hic` file actually provides — see the
model's `activeNormalization` getter.

**Type:** `string` · **Default:** `'KR'`

#### slot: fitToHeight

squash the triangle vertically to fit the display height instead of drawing
square bins

**Type:** `boolean` · **Default:** `false`

</details>

## Inherited config slots

Slots available on this config via its base configuration(s), shown in full so
this page is self-contained. A slot redeclared by a more specific config is
shown once, at its most specific definition.

<details>
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

## Related links

- **Adapter:** [HicAdapter](../hicadapter)
- **State model:** [runtime API](../../models/linearhicdisplay)
- **Base config:** [BaseLinearDisplay](../baselineardisplay)
