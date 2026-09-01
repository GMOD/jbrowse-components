---
id: linearmultisamplevariantmatrixdisplay
title: LinearMultiSampleVariantMatrixDisplay
sidebar_label: Display -> LinearMultiSampleVariantMatrixDisplay
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `variants` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/LinearMultiSampleVariantMatrixDisplay/configSchema.ts).

## Example usage

Minimal `VariantTrack` config selecting the matrix display. The `displays`
array form is required here (rather than the object shorthand) because
this is a non-default display type — see
[configuring displays](/docs/config_guides/tracks#configuring-displays):

```js
{
  type: 'VariantTrack',
  trackId: 'cohort',
  name: 'Cohort variants',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'VcfTabixAdapter',
    uri: 'https://example.com/cohort.vcf.gz',
  },
  displays: [
    {
      type: 'LinearMultiSampleVariantMatrixDisplay',
    },
  ],
}
```

Preloading sample metadata: point the adapter's `samplesTsvLocation` at a TSV
whose first column is the sample name and whose other columns are per-sample
attributes (e.g. `population`), then `colorBy` one of those attributes to
color the matrix rows on load (same metadata mechanism as the regular
`LinearMultiSampleVariantDisplay`):

```js
{
  type: 'VariantTrack',
  trackId: 'cohort',
  name: 'Cohort variants',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'VcfTabixAdapter',
    uri: 'https://example.com/cohort.vcf.gz',
    samplesTsvLocation: { uri: 'https://example.com/samples.tsv' },
  },
  displays: [
    {
      type: 'LinearMultiSampleVariantMatrixDisplay',
      height: 400,
      colorBy: 'population',
    },
  ],
}
```

Taller matrix filtering rare variants (MAF < 5 %). Row order, per-row color
and group labels come from the adapter's `samplesTsvLocation` above — the
display's own `layout` holds the arrangement the user then drags into place,
so it is session state rather than a config slot:

```js
{
  type: 'VariantTrack',
  trackId: 'cohort',
  name: 'Cohort variants',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'VcfTabixAdapter',
    uri: 'https://example.com/cohort.vcf.gz',
  },
  displays: [
    {
      type: 'LinearMultiSampleVariantMatrixDisplay',
      height: 400,
      minorAlleleFrequencyFilter: 0.05,
    },
  ],
}
```

_See the **Config slots** section below for all available configuration fields._

## Related links

- **Adapter:** [BedpeAdapter](../bedpeadapter)
- **Adapter:** [SplitVcfTabixAdapter](../splitvcftabixadapter)
- **Adapter:** [StarFusionAdapter](../starfusionadapter)
- **Adapter:** [VcfAdapter](../vcfadapter)
- **Adapter:** [VcfTabixAdapter](../vcftabixadapter)
- **State model:** [runtime API](../../models/linearmultisamplevariantmatrixdisplay)
- **Base config:** [SharedVariantDisplay](../sharedvariantdisplay)

## Config slots

These slots go on a display entry: `"displays": [{ "type": "LinearMultiSampleVariantMatrixDisplay", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>250</code> | Starting height in pixels for the whole display, including the lineZoneHeight band above the rows; drag-resizable, and the rows divide what is left over while row height is on auto-fit |
| <span id="slot-linezoneheight">**lineZoneHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>20</code> | Raises the shared slot's 0 default: this display lays columns out by feature index, so it needs the zone for the lines tying each column back to its genomic position. Drag-resizable, like `height`.<br>_advanced_ |
| <span class="slot-group">Inherited from [SharedVariantDisplay](../sharedvariantdisplay)</span> | <span class="slot-group-count">15 slots</span> |
| <span id="slot-showreferencealleles">**showReferenceAlleles**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Starting value for drawing reference alleles. When false, the row background is filled solid grey and only ALT alleles are painted on top (makes overlapping variants easier to see); when true, reference alleles are drawn normally. Seeds referenceDrawingMode the first time a config is loaded. |
| <span id="slot-showrowseparators">**showRowSeparators**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Draw a hairline between adjacent sample rows. Off by default, and only drawn once rows are at least 4px tall — below that the line is as thick as the row it borders. |
| <span id="slot-showtooltips">**showTooltips**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Show the hover tooltip naming the genotype, the sample and the record under the pointer. On by default; turning it off leaves every other hover affordance — the crosshairs, the highlighted cell, the cross-display `session.hovered` channel — alone, so the pointer still says where it is while the panel stops covering the rows beside it.<br><br>A config slot rather than a display property, so a track config can ship with it off and a figure capture keeps it off across a reload. Both multi-sample displays honor it: they draw the same tooltip off the same `hoveredGenotype` slot. |
| <span id="slot-renderingmode">**renderingMode**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (alleleCount, phased) = <code>'alleleCount'</code> | 'alleleCount' draws one row per sample colored by allele dosage; 'phased' draws one row per haplotype |
| <span id="slot-featurecolor">**featureColor**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | Optional per-feature color for the genotype cells: a jexl expression (or plain CSS color) evaluated once per variant in the worker, painting every alt-carrying cell with that color while ref/no-call cells keep their normal coloring so "who carries it" still reads. Empty means the default genotype-based coloring (allele dosage / phasing). The "Color by..." menu offers presets like consequence impact (`jexl:impactColor(feature)`), but any feature jexl works, same as the standard `color` slot. |
| <span id="slot-minorallelefrequencyfilter">**minorAlleleFrequencyFilter**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | Hide variants whose minor allele frequency is below this threshold<br>_advanced_ |
| <span id="slot-maxmissingnessfilter">**maxMissingnessFilter**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | Hide variants whose fraction of no-call (missing) genotypes is above this threshold; 1 keeps every variant<br>_advanced_ |
| <span id="slot-showlegend">**showLegend**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) = <code>true</code> _promotable_ | Whether to draw the floating legend over the display. It is clipped to the display's own bounds, so while it is on it sets a floor under the lane height: turn it off to size a short lane to its rows rather than to its key, which is what a one-record SV call genotyped across a handful of carriers wants. |
| <span id="slot-colorby">**colorBy**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | Name of a sample-metadata attribute (a column in the adapter's samplesTsvLocation, e.g. 'population') to color the sidebar rows by; empty means no grouping |
| <span id="slot-groupby">**groupBy**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | Name of a sample-metadata attribute (a column in the adapter's samplesTsvLocation, e.g. 'population') to order the sample rows by, so each group's rows are contiguous and a group-restricted genotype pattern reads as one band; empty means the rows keep their existing order |
| <span id="slot-referencedrawingmode">**referenceDrawingMode**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (draw, skip) = <code>'skip'</code> | A 'draw'/'skip' toggle for reference alleles, settable independent of showReferenceAlleles (the admin-config-only starting default). No fallback derivation at read time — preProcessSnapshot below seeds this from showReferenceAlleles once, the first time a config lacking it is hydrated, so from then on this slot alone is the single source of truth. |
| <span id="slot-rowheight">**rowHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | per-row height in px, scrolling the rows that do not fit; 0 (the default) fits the rows to the display height instead, dividing it between them |
| <span id="slot-showtree">**showTree**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Show the sample clustering tree in the sidebar |
| <span id="slot-showbranchlength">**showBranchLength**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | position tree nodes by branch length (dendrogram) rather than evenly by topology (cladogram) |
| <span id="slot-showrowlabels">**showRowLabels**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Show the per-sample row labels in the sidebar |
| <span class="slot-group">Inherited from [BaseLinearDisplay](../baselineardisplay)</span> | <span class="slot-group-count">7 slots</span> |
| <span id="slot-maxfeaturescreendensity">**maxFeatureScreenDensity**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | maximum features per pixel before showing a "too many features" message<br>_advanced_ |
| <span id="slot-mouseover">**mouseover**</span><br>[`string`](/docs/config_guides/slot_types#string) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>'jexl:get(feature,'_mouseOver')&#124;&#124;get(feature,'name')&#124;&#124;get(featu…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>'jexl:get(feature,'_mouseOver')&#124;&#124;get(feature,'name')&#124;&#124;get(feature,'function')&#124;&#124;get(feature,'id')'</code></pre></dialog></span> | text to display when the cursor hovers over a feature<br>_callback args:_ `feature` |
| <span id="slot-jexlfilters">**jexlFilters**</span><br>`stringArray` = <code>[]</code> | config jexlFilters are deferred evaluated so they are prepended with jexl at runtime rather than being stored with jexl in the config |
| <span id="slot-fetchsizelimit">**fetchSizeLimit**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1_000_000</code> | maximum data to attempt to download for a given track, used if adapter doesn't specify one<br>_advanced_ |
| <span id="slot-forceload">**forceLoad**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Declarative equivalent of the "Force load" button on the "too much data" banner: when true the display always renders, however large the region or dense the features. Off by default (the gate guards against huge downloads). Set it on a view no one can interact with — an embedded / notebook view, or a screenshot — where the region is known and you want it drawn without a click.<br>_advanced_ |
| <span id="slot-densitytier">**densityTier**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (auto, features, density) = <code>'auto'</code> | when to draw the features-per-bin density band in place of features: "auto" swaps to it where the region is too large to fetch, "features" never does and keeps the banner, "density" always does. Needs a density source on the adapter (its densityAdapter slot)<br>_advanced_ |
| <span id="slot-densitytierbpperpx">**densityTierBpPerPx**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | in "auto" mode, also draw the density band from this many bp per pixel outward, before the region is too large to fetch; 0 leaves the swap to the fetch-size gate alone<br>_advanced_ |
