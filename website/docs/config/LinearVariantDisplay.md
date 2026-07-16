---
id: linearvariantdisplay
title: LinearVariantDisplay
sidebar_label: Display -> LinearVariantDisplay
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `variants`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/LinearVariantDisplay/configSchema.ts).

## Example usage

Minimal `VariantTrack` config. See the
[variant track guide](/docs/config_guides/variant_track) for all options:

```js
{
  type: 'VariantTrack',
  trackId: 'variants',
  name: 'Variants',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'VcfTabixAdapter',
    uri: 'https://example.com/variants.vcf.gz',
  },
}
```

Taller track. The `displayDefaults` object shorthand is equivalent to
`displays: [{ type: 'LinearVariantDisplay', displayId: '...', ... }]` — see
[configuring displays](/docs/config_guides/tracks#configuring-displays):

```js
{
  type: 'VariantTrack',
  trackId: 'variants',
  name: 'Variants',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'VcfTabixAdapter',
    uri: 'https://example.com/variants.vcf.gz',
  },
  displayDefaults: { height: 200 },
}
```

_See the **Config slots** section below for all available configuration fields._

Extends LinearCanvasBaseDisplay for GPU-accelerated variant rendering.

## Related links

- **Adapter:** [BedpeAdapter](../bedpeadapter)
- **Adapter:** [StarFusionAdapter](../starfusionadapter)
- **Adapter:** [SplitVcfTabixAdapter](../splitvcftabixadapter)
- **Adapter:** [VcfAdapter](../vcfadapter)
- **Adapter:** [VcfTabixAdapter](../vcftabixadapter)
- **State model:** [runtime API](../../models/linearvariantdisplay)
- **Base config:** [LinearCanvasBaseDisplay](../linearcanvasbasedisplay)

## Inherited config slots

Slots available on this config via its base configuration(s), shown in full so
this page is self-contained. A slot redeclared by a more specific config is
shown once, at its most specific definition.

<details>
<summary>Inherited from LinearCanvasBaseDisplay</summary>

[LinearCanvasBaseDisplay config →](../linearcanvasbasedisplay)

#### slot: maxHeight

Maximum height of the display in pixels

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:**
`1200` · _advanced_

#### slot: heightMode

Track-sizing strategy — how the track responds when there are more features than
fit (shared vocabulary with the alignments display, exposed in the "Track
sizing" menu). `inherit` (the default) follows the session-wide default for this
display type, falling back to `fixed`; `fixed` keeps a scrollable fixed height,
`grow` expands the track to show all features, `fit` squeezes features to fill
the current height. Orthogonal to the per-feature size set by `displayMode`.
Unifies the former `autoHeight` (grow) + `squeezeToDisplayHeight` (fit)
settings.

**Type:** [`stringEnum`](/docs/config_guides/slot_types#stringenum) ·
**Default:** `'inherit'` · _promotable_

```js
{
  type: 'stringEnum',
  model: types.enumeration('heightMode', [...HEIGHT_MODE_VALUES]),
  description:
    'Track-sizing strategy — how the track responds when there are more features than fit (shared vocabulary with the alignments display, exposed in the "Track sizing" menu). `inherit` (the default) follows the session-wide default for this display type, falling back to `fixed`; `fixed` keeps a scrollable fixed height, `grow` expands the track to show all features, `fit` squeezes features to fill the current height. Orthogonal to the per-feature size set by `displayMode`. Unifies the former `autoHeight` (grow) + `squeezeToDisplayHeight` (fit) settings.',





  defaultValue: 'inherit',
  promotedBase: 'fixed',
  promotable: true,
}
```

#### slot: showLabels

Show feature labels: "auto" hides labels at high feature density, "on" always
shows, "off" always hides

**Type:** [`stringEnum`](/docs/config_guides/slot_types#stringenum) ·
**Default:** `'auto'`

```js
{
  type: 'stringEnum',
  model: types.enumeration('showLabels', [...SHOW_LABELS_MODES]),
  defaultValue: 'auto',
  description:
    'Show feature labels: "auto" hides labels at high feature density, "on" always shows, "off" always hides',
}
```

#### slot: maxLabelFeatureDensity

In "auto" showLabels mode, hide labels when visible feature density
(features/pixel) exceeds this value

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:**
`MAX_LABEL_FEATURE_DENSITY` · _advanced_

#### slot: showDescriptions

Show feature descriptions

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`true`

#### slot: color

the main fill color of each feature (a CSS color, or a jexl expression for
per-feature coloring). Unset, a feature's own BED itemRgb paints it if it has
one, else goldenrod

**Type:** `maybeColor` · **Default:** `undefined`

```js
{
  type: 'maybeColor',
  defaultValue: undefined,
  description:
    "the main fill color of each feature (a CSS color, or a jexl expression for per-feature coloring). Unset, a feature's own BED itemRgb paints it if it has one, else goldenrod",
  contextVariable: ['feature'],
}
```

#### slot: connectorColor

color of the connecting/intron lines between feature segments (defaults to the
theme text color)

**Type:** `maybeColor` · **Default:** `undefined`

```js
{
  type: 'maybeColor',
  description:
    'color of the connecting/intron lines between feature segments (defaults to the theme text color)',
  defaultValue: undefined,
  contextVariable: ['feature'],
}
```

#### slot: utrColor

fill color for UTRs on gene/transcript glyphs. Unset, a feature's own BED
itemRgb paints them too (matching UCSC's whole-item coloring), else a
contrasting blue

**Type:** `maybeColor` · **Default:** `undefined`

```js
{
  type: 'maybeColor',
  defaultValue: undefined,
  description:
    "fill color for UTRs on gene/transcript glyphs. Unset, a feature's own BED itemRgb paints them too (matching UCSC's whole-item coloring), else a contrasting blue",
  contextVariable: ['feature'],
}
```

#### slot: outlineColor

outline color for features (empty string = no outline)

**Type:** [`color`](/docs/config_guides/slot_types#color) · **Default:** `''`

#### slot: featureHeight

height in pixels of the main body of each feature

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `10`

```js
{
  type: 'number',
  description: 'height in pixels of the main body of each feature',
  defaultValue: 10,
  contextVariable: ['feature'],
}
```

#### slot: displayMode

Feature height preset. `inherit` (the default) follows the session-wide default
for this display type, falling back to `normal`;
`normal`/`compact`/`superCompact` customize the track explicitly (including
customizing `normal` back over a `compact` session default)

**Type:** [`stringEnum`](/docs/config_guides/slot_types#stringenum) (one of
`inherit`, `normal`, `compact`, `superCompact`) · **Default:** `'inherit'` ·
_promotable_

```js
{
  type: 'stringEnum',
  model: types.enumeration('displayMode', [
    'inherit',
    'normal',
    'compact',
    'superCompact',
  ]),
  description:
    'Feature height preset. `inherit` (the default) follows the session-wide default for this display type, falling back to `normal`; `normal`/`compact`/`superCompact` customize the track explicitly (including customizing `normal` back over a `compact` session default)',






  defaultValue: 'inherit',
  promotedBase: 'normal',
  promotable: true,
}
```

#### slot: geneGlyphMode

Gene glyph display mode: "auto" switches based on zoom level, "all" shows all
transcripts, "longestCoding" shows only the longest coding transcript

**Type:** [`stringEnum`](/docs/config_guides/slot_types#stringenum) ·
**Default:** `'auto'`

```js
{
  type: 'stringEnum',
  model: types.enumeration('geneGlyphMode', [...GENE_GLYPH_MODES]),
  description:
    'Gene glyph display mode: "auto" switches based on zoom level, "all" shows all transcripts, "longestCoding" shows only the longest coding transcript',
  defaultValue: 'auto',
}
```

#### slot: subfeatureLabels

subfeature label display mode. `inherit` (the default) follows the session-wide
default for this display type, falling back to `none`; `none`/`below`/`overlay`
customize the track explicitly

**Type:** [`stringEnum`](/docs/config_guides/slot_types#stringenum) (one of
`inherit`, `none`, `below`, `overlay`) · **Default:** `'inherit'` · _promotable_

```js
{
  type: 'stringEnum',
  model: types.enumeration('subfeatureLabels', [
    'inherit',
    'none',
    'below',
    'overlay',
  ]),
  description:
    'subfeature label display mode. `inherit` (the default) follows the session-wide default for this display type, falling back to `none`; `none`/`below`/`overlay` customize the track explicitly',






  defaultValue: 'inherit',
  promotedBase: 'none',
  promotable: true,
}
```

#### slot: displayDirectionalChevrons

Display directional chevrons on intron lines to indicate strand direction. Unset
(the default) follows the session-wide default for this display type, falling
back to on; an explicit true/false customizes the track (including customizing
on over an off session default)

**Type:** [`maybeBoolean`](/docs/config_guides/slot_types#maybeboolean) ·
**Default:** `undefined` · _promotable_

```js
{
  type: 'maybeBoolean',
  description:
    'Display directional chevrons on intron lines to indicate strand direction. Unset (the default) follows the session-wide default for this display type, falling back to on; an explicit true/false customizes the track (including customizing on over an off session default)',






  defaultValue: undefined,
  promotedBase: true,
  promotable: true,
}
```

#### slot: transcriptTypes

**Type:** `stringArray`

```js
{
  type: 'stringArray',







  defaultValue: [
    'mRNA',
    'transcript',
    'primary_transcript',
    'V_gene_segment',
    'C_gene_segment',
    'D_gene_segment',
    'J_gene_segment',
  ],
}
```

#### slot: containerTypes

**Type:** `stringArray` · **Default:** `['proteoform_orf']`

#### slot: subParts

subparts for a glyph

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:**
`'CDS,UTR,five_prime_UTR,three_prime_UTR'`

#### slot: impliedUTRs

imply UTRs from exon/CDS differences on transcript glyphs that carry no explicit
UTR subfeatures

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`true`

#### slot: labels

```js
ConfigurationSchema('CanvasFeatureLabels', {
  name: {
    type: 'string',
    description: 'the primary name of the feature to show',
    defaultValue: `jexl:get(feature,'name') || get(feature,'id')`,
    contextVariable: ['feature'],
  },

  description: {
    type: 'string',
    description: 'the text description to show',

    defaultValue: `jexl:get(feature,'note') || get(feature,'description') || get(feature,'function')`,
    contextVariable: ['feature'],
  },
})
```

#### slot: labels.name

the primary name of the feature to show

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:**
`'jexl:get(feature,'name') || get(feature,'id')'`

```js
{
  type: 'string',
  description: 'the primary name of the feature to show',
  defaultValue: `jexl:get(feature,'name') || get(feature,'id')`,
  contextVariable: ['feature'],
}
```

#### slot: labels.description

the text description to show

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:**
`'jexl:get(feature,'note') || get(feature,'description') || get(feature,'function')'`

```js
{
  type: 'string',
  description: 'the text description to show',





  defaultValue: `jexl:get(feature,'note') || get(feature,'description') || get(feature,'function')`,
  contextVariable: ['feature'],
}
```

</details>

<details>
<summary>Inherited from BaseLinearDisplay</summary>

[BaseLinearDisplay config →](../baselineardisplay)

#### slot: maxFeatureScreenDensity

maximum features per pixel before showing a "too many features" message, used if
byte size estimates are not available

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `1` ·
_advanced_

#### slot: fetchSizeLimit

maximum data to attempt to download for a given track, used if adapter doesn't
specify one

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:**
`1_000_000` · _advanced_

#### slot: height

default height for the track

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `100`

#### slot: mouseover

text to display when the cursor hovers over a feature

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:**
`'jexl:get(feature,'_mouseOver')||get(feature,'name')||get(feature,'function')||get(feature,'id')'`

```js
{
  type: 'string',
  description: 'text to display when the cursor hovers over a feature',



  defaultValue: `jexl:get(feature,'_mouseOver')||get(feature,'name')||get(feature,'function')||get(feature,'id')`,
  contextVariable: ['feature'],
}
```

#### slot: jexlFilters

config jexlFilters are deferred evaluated so they are prepended with jexl at
runtime rather than being stored with jexl in the config

**Type:** `stringArray` · **Default:** `[]`

</details>
