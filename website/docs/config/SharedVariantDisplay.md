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

- **Extended by:**
  [LinearMultiSampleVariantDisplay](../linearmultisamplevariantdisplay)
- **Extended by:**
  [LinearMultiSampleVariantMatrixDisplay](../linearmultisamplevariantmatrixdisplay)
- **Base config:** [BaseLinearDisplay](../baselineardisplay)

## Config slots

`SharedVariantDisplay` is a shared base schema, not a type you name in a config.
Set these slots on one of the configs under **Extended by** above, each of which
lists them as inherited and shows the shape in its own example. Slot types
(`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types). Slots a base
configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description | From |
| --- | --- | --- |
| <span id="slot-showreferencealleles">**showReferenceAlleles**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Starting value for drawing reference alleles. When false, the row background is filled solid grey and only ALT alleles are painted on top (makes overlapping variants easier to see); when true, reference alleles are drawn normally. Seeds referenceDrawingMode the first time a config is loaded. |  |
| <span id="slot-showsidebarlabels">**showSidebarLabels**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Show the per-sample row labels in the sidebar |  |
| <span id="slot-linezoneheight">**lineZoneHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | Height of the zone above the rows holding the lines that tie each matrix column to its genomic position. 0 (the default here) means no zone at all — only the matrix display, which lays columns out by feature index rather than at their genomic positions, raises it.<br>_advanced_ |  |
| <span id="slot-showtree">**showTree**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Show the sample clustering tree in the sidebar |  |
| <span id="slot-showbranchlength">**showBranchLength**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Draw the clustering tree with branch lengths |  |
| <span id="slot-renderingmode">**renderingMode**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (alleleCount, phased) = <code>'alleleCount'</code> | 'alleleCount' draws one row per sample colored by allele dosage; 'phased' draws one row per haplotype |  |
| <span id="slot-featurecolor">**featureColor**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | Optional per-feature color for the genotype cells: a jexl expression (or plain CSS color) evaluated once per variant in the worker, painting every alt-carrying cell with that color while ref/no-call cells keep their normal coloring so "who carries it" still reads. Empty means the default genotype-based coloring (allele dosage / phasing). The "Color by..." menu offers presets like consequence impact (`jexl:impactColor(feature)`), but any feature jexl works, same as the standard `color` slot. |  |
| <span id="slot-minorallelefrequencyfilter">**minorAlleleFrequencyFilter**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | Hide variants whose minor allele frequency is below this threshold<br>_advanced_ |  |
| <span id="slot-maxmissingnessfilter">**maxMissingnessFilter**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | Hide variants whose fraction of no-call (missing) genotypes is above this threshold; 1 keeps every variant<br>_advanced_ |  |
| <span id="slot-colorby">**colorBy**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | Name of a sample-metadata attribute (a column in the adapter's samplesTsvLocation, e.g. 'population') to color the sidebar rows by; empty means no grouping |  |
| <span id="slot-groupby">**groupBy**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | Name of a sample-metadata attribute (a column in the adapter's samplesTsvLocation, e.g. 'population') to order the sample rows by, so each group's rows are contiguous and a group-restricted genotype pattern reads as one band; empty means the rows keep their existing order |  |
| <span id="slot-referencedrawingmode">**referenceDrawingMode**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (draw, skip) = <code>'skip'</code> | A 'draw'/'skip' toggle for reference alleles, settable independent of showReferenceAlleles (the admin-config-only starting default). No fallback derivation at read time — preProcessSnapshot below seeds this from showReferenceAlleles once, the first time a config lacking it is hydrated, so from then on this slot alone is the single source of truth. |  |
| <span id="slot-maxfeaturescreendensity">**maxFeatureScreenDensity**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | maximum features per pixel before showing a "too many features" message, used if byte size estimates are not available<br>_advanced_ | [BaseLinearDisplay](../baselineardisplay) |
| <span id="slot-fetchsizelimit">**fetchSizeLimit**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1_000_000</code> | maximum data to attempt to download for a given track, used if adapter doesn't specify one<br>_advanced_ | [BaseLinearDisplay](../baselineardisplay) |
| <span id="slot-forceload">**forceLoad**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Declarative equivalent of the "Force load" button on the "too much data" banner: when true the display always renders, however large the region or dense the features. Off by default (the gate guards against huge downloads). Set it on a view no one can interact with — an embedded / notebook view, or a screenshot — where the region is known and you want it drawn without a click.<br>_advanced_ | [BaseLinearDisplay](../baselineardisplay) |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>100</code> | default height for the track | [BaseLinearDisplay](../baselineardisplay) |
| <span id="slot-mouseover">**mouseover**</span><br>[`string`](/docs/config_guides/slot_types#string) = <details><summary><code>'jexl:get(feature,'_mouseOver')&#124;&#124;get(feature,'name')&#124;&#124;get(featu…</code></summary><pre><code>'jexl:get(feature,'_mouseOver')&#124;&#124;get(feature,'name')&#124;&#124;get(feature,'function')&#124;&#124;get(feature,'id')'</code></pre></details> | text to display when the cursor hovers over a feature<br>_callback args:_ `feature` | [BaseLinearDisplay](../baselineardisplay) |
| <span id="slot-jexlfilters">**jexlFilters**</span><br>`stringArray` = <code>[`get(feature,'gbkey')!='Src'`]</code> | config jexlFilters are deferred evaluated so they are prepended with jexl at runtime rather than being stored with jexl in the config | [BaseLinearDisplay](../baselineardisplay) |
