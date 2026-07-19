---
id: sharedlddisplay
title: SharedLDDisplay
sidebar_label: Display -> SharedLDDisplay
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `variants`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/LDDisplay/SharedLDConfigSchema.ts).

## Related links

- **Base config:** [BaseLinearDisplay](../baselineardisplay)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                         | Type                      | Description                                                                 |
| -------------------------------------------- | ------------------------- | --------------------------------------------------------------------------- |
| [ldMetric](#slot-ldmetric)                   | `stringEnum` (r2, dprime) | LD metric to compute: 'r2' (squared correlation) or 'dprime' (normalized D) |
| [showLegend](#slot-showlegend)               | `boolean`                 | Whether to show the legend                                                  |
| [showLDTriangle](#slot-showldtriangle)       | `boolean`                 | Whether to show the LD triangle heatmap                                     |
| [showRecombination](#slot-showrecombination) | `boolean`                 | Whether to show the recombination rate track                                |

<details>
<summary>Advanced slots (13)</summary>

| Slot                                                           | Type          | Description                                                                                        |
| -------------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------- |
| [minorAlleleFrequencyFilter](#slot-minorallelefrequencyfilter) | `number`      | Filter variants by minor allele frequency (0-1).                                                   |
| [lengthCutoffFilter](#slot-lengthcutofffilter)                 | `number`      | Maximum length of variants to include (in bp)                                                      |
| [lineZoneHeight](#slot-linezoneheight)                         | `number`      | Height of the zone for connecting lines at the top                                                 |
| [recombinationZoneHeight](#slot-recombinationzoneheight)       | `number`      | Height of the recombination track zone at the top                                                  |
| [fitToHeight](#slot-fittoheight)                               | `boolean`     | When true, squash the LD triangle to fit the display height                                        |
| [hweFilterThreshold](#slot-hwefilterthreshold)                 | `number`      | HWE filter p-value threshold (variants with HWE p < this are excluded).                            |
| [callRateFilter](#slot-callratefilter)                         | `number`      | Call rate filter threshold (0-1).                                                                  |
| [showVerticalGuides](#slot-showverticalguides)                 | `boolean`     | Whether to show vertical guides at the connected genome positions on hover                         |
| [showLabels](#slot-showlabels)                                 | `boolean`     | Whether to show variant labels above the tick marks                                                |
| [tickHeight](#slot-tickheight)                                 | `number`      | Height of the vertical tick marks at the genomic position                                          |
| [useGenomicPositions](#slot-usegenomicpositions)               | `boolean`     | When true, draw cells sized according to genomic distance between SNPs rather than uniform squares |
| [signedLD](#slot-signedld)                                     | `boolean`     | When true, show signed LD values (-1 to 1) instead of absolute values (0 to 1).                    |
| [jexlFilters](#slot-jexlfilters)                               | `stringArray` | JEXL filter expressions to apply to variants (one per line, starting with jexl:)                   |

</details>

<details>
<summary>SharedLDDisplay - Slots</summary>

#### slot: minorAlleleFrequencyFilter

Filter variants by minor allele frequency (0-1). Variants with MAF below this
threshold will be hidden

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `0.1`
· _advanced_

#### slot: lengthCutoffFilter

Maximum length of variants to include (in bp)

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:**
`Number.MAX_SAFE_INTEGER` · _advanced_

#### slot: lineZoneHeight

Height of the zone for connecting lines at the top

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `100`
· _advanced_

#### slot: ldMetric

LD metric to compute: 'r2' (squared correlation) or 'dprime' (normalized D)

**Type:** [`stringEnum`](/docs/config_guides/slot_types#stringenum) (one of
`r2`, `dprime`) · **Default:** `'r2'`

#### slot: showLegend

Whether to show the legend

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`false`

#### slot: showLDTriangle

Whether to show the LD triangle heatmap

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`true`

#### slot: showRecombination

Whether to show the recombination rate track

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`false`

#### slot: recombinationZoneHeight

Height of the recombination track zone at the top

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `50`
· _advanced_

#### slot: fitToHeight

When true, squash the LD triangle to fit the display height

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`false` · _advanced_

#### slot: hweFilterThreshold

HWE filter p-value threshold (variants with HWE p < this are excluded). Set to 0
to disable HWE filtering

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `0` ·
_advanced_

#### slot: callRateFilter

Call rate filter threshold (0-1). Variants with fewer than this proportion of
non-missing genotypes are excluded. Set to 0 to disable.

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `0` ·
_advanced_

#### slot: showVerticalGuides

Whether to show vertical guides at the connected genome positions on hover

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`true` · _advanced_

#### slot: showLabels

Whether to show variant labels above the tick marks

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`false` · _advanced_

#### slot: tickHeight

Height of the vertical tick marks at the genomic position

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `6` ·
_advanced_

#### slot: useGenomicPositions

When true, draw cells sized according to genomic distance between SNPs rather
than uniform squares

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`false` · _advanced_

#### slot: signedLD

When true, show signed LD values (-1 to 1) instead of absolute values (0 to 1).
For R², this shows R (correlation) instead. For D', this preserves the sign.

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`false` · _advanced_

#### slot: jexlFilters

JEXL filter expressions to apply to variants (one per line, starting with jexl:)

**Type:** `stringArray` · **Default:** `[]` · _advanced_

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

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `1` ·
_advanced_

#### slot: fetchSizeLimit

maximum data to attempt to download for a given track, used if adapter doesn't
specify one

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:**
`1_000_000` · _advanced_

#### slot: forceLoad

Declarative equivalent of the "Force load" button on the "too much data" banner:
when true the display always renders, however large the region or dense the
features. Off by default (the gate guards against huge downloads). Set it on a
view no one can interact with — an embedded / notebook view, or a screenshot —
where the region is known and you want it drawn without a click.

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`false` · _advanced_

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

</details>
