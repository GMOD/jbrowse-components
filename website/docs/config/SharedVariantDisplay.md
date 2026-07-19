---
id: sharedvariantdisplay
title: SharedVariantDisplay
sidebar_label: Display -> SharedVariantDisplay
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `variants`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/shared/SharedVariantConfigSchema.ts).

## Related links

- **Base config:** [BaseLinearDisplay](../baselineardisplay)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                               | Type                               | Description                                                                                                                                                                                                                                                              |
| -------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [showReferenceAlleles](#slot-showreferencealleles) | `boolean`                          | Starting value for drawing reference alleles.                                                                                                                                                                                                                            |
| [showSidebarLabels](#slot-showsidebarlabels)       | `boolean`                          | Show the per-sample row labels in the sidebar                                                                                                                                                                                                                            |
| [showTree](#slot-showtree)                         | `boolean`                          | Show the sample clustering tree in the sidebar                                                                                                                                                                                                                           |
| [showBranchLength](#slot-showbranchlength)         | `boolean`                          | Draw the clustering tree with branch lengths                                                                                                                                                                                                                             |
| [renderingMode](#slot-renderingmode)               | `stringEnum` (alleleCount, phased) | 'alleleCount' draws one row per sample colored by allele dosage; 'phased' draws one row per haplotype                                                                                                                                                                    |
| [featureColor](#slot-featurecolor)                 | `string`                           | Optional per-feature color for the genotype cells: a jexl expression (or plain CSS color) evaluated once per variant in the worker, painting every alt-carrying cell with that color while ref/no-call cells keep their normal coloring so "who carries it" still reads. |
| [colorBy](#slot-colorby)                           | `string`                           | Name of a sample-metadata attribute (a column in the adapter's samplesTsvLocation, e.g. 'population') to color the sidebar rows by; empty means no grouping                                                                                                              |
| [referenceDrawingMode](#slot-referencedrawingmode) | `stringEnum` (draw, skip)          | A 'draw'/'skip' toggle for reference alleles, settable independent of showReferenceAlleles (the admin-config-only starting default).                                                                                                                                     |

<details>
<summary>Advanced slots (2)</summary>

| Slot                                                           | Type     | Description                                                                                                |
| -------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| [minorAlleleFrequencyFilter](#slot-minorallelefrequencyfilter) | `number` | Hide variants whose minor allele frequency is below this threshold                                         |
| [maxMissingnessFilter](#slot-maxmissingnessfilter)             | `number` | Hide variants whose fraction of no-call (missing) genotypes is above this threshold; 1 keeps every variant |

</details>

<details>
<summary>SharedVariantDisplay - Slots</summary>

#### slot: showReferenceAlleles

Starting value for drawing reference alleles. When false, the row background is
filled solid grey and only ALT alleles are painted on top (makes overlapping
variants easier to see); when true, reference alleles are drawn normally. Seeds
referenceDrawingMode the first time a config is loaded.

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`false`

#### slot: showSidebarLabels

Show the per-sample row labels in the sidebar

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`true`

#### slot: showTree

Show the sample clustering tree in the sidebar

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`true`

#### slot: showBranchLength

Draw the clustering tree with branch lengths

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`true`

#### slot: renderingMode

'alleleCount' draws one row per sample colored by allele dosage; 'phased' draws
one row per haplotype

**Type:** [`stringEnum`](/docs/config_guides/slot_types#stringenum) (one of
`alleleCount`, `phased`) · **Default:** `'alleleCount'`

#### slot: featureColor

Optional per-feature color for the genotype cells: a jexl expression (or plain
CSS color) evaluated once per variant in the worker, painting every alt-carrying
cell with that color while ref/no-call cells keep their normal coloring so "who
carries it" still reads. Empty means the default genotype-based coloring (allele
dosage / phasing). The "Color by..." menu offers presets like consequence impact
(`jexl:impactColor(feature)`), but any feature jexl works, same as the standard
`color` slot.

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:** `''`

#### slot: minorAlleleFrequencyFilter

Hide variants whose minor allele frequency is below this threshold

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `0` ·
_advanced_

#### slot: maxMissingnessFilter

Hide variants whose fraction of no-call (missing) genotypes is above this
threshold; 1 keeps every variant

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `1` ·
_advanced_

#### slot: colorBy

Name of a sample-metadata attribute (a column in the adapter's
samplesTsvLocation, e.g. 'population') to color the sidebar rows by; empty means
no grouping

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:** `''`

#### slot: referenceDrawingMode

A 'draw'/'skip' toggle for reference alleles, settable independent of
showReferenceAlleles (the admin-config-only starting default). No fallback
derivation at read time — preProcessSnapshot below seeds this from
showReferenceAlleles once, the first time a config lacking it is hydrated, so
from then on this slot alone is the single source of truth.

**Type:** [`stringEnum`](/docs/config_guides/slot_types#stringenum) (one of
`draw`, `skip`) · **Default:** `'skip'`

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

#### slot: jexlFilters

config jexlFilters are deferred evaluated so they are prepended with jexl at
runtime rather than being stored with jexl in the config

**Type:** `stringArray` · **Default:** `[`get(feature,'gbkey')!='Src'`]`

</details>
