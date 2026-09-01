---
id: sharedlddisplay
title: SharedLDDisplay
sidebar_label: Display -> SharedLDDisplay
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `variants` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/LDDisplay/SharedLDConfigSchema.ts).

Shared config for the two LD displays: `LDDisplay` (on a `VariantTrack`,
computing pairwise R² from the VCF's own genotypes) and `LDTrackDisplay` (on
an `LDTrack`, reading pre-computed LD such as PLINK `--r2` output). Both
register the same slots against different track types, so the slots live here
once.

## Related links

- **Extended by:** [LDDisplay](../lddisplay)
- **Extended by:** [LDTrackDisplay](../ldtrackdisplay)
- **Base config:** [BaseLinearDisplay](../baselineardisplay)

## Config slots

`SharedLDDisplay` is a shared base schema, not a type you name in a config. Set these slots on one of the configs under **Extended by** above, each of which lists them as inherited and shows the shape in its own example. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-minorallelefrequencyfilter">**minorAlleleFrequencyFilter**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0.1</code> | Filter variants by minor allele frequency (0-1). Variants with MAF below this threshold will be hidden<br>_advanced_ |
| <span id="slot-lengthcutofffilter">**lengthCutoffFilter**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>Number.MAX_SAFE_INTEGER</code> | Maximum length of variants to include (in bp)<br>_advanced_ |
| <span id="slot-linezoneheight">**lineZoneHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>100</code> | Height of the zone for connecting lines at the top<br>_advanced_ |
| <span id="slot-ldmetric">**ldMetric**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (r2, dprime) = <code>'r2'</code> | LD metric to compute: 'r2' (squared correlation) or 'dprime' (normalized D) |
| <span id="slot-showlegend">**showLegend**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) = <code>false</code> _promotable_ | Whether to show the legend. Unset (the default) follows the session-wide default for this display type, falling back to off; an explicit true/false customizes the track. |
| <span id="slot-showldtriangle">**showLDTriangle**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Whether to show the LD triangle heatmap |
| <span id="slot-squashtoheight">**squashToHeight**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | When true, squash the LD triangle to fit the display height<br>_advanced_ |
| <span id="slot-hwefilterthreshold">**hweFilterThreshold**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | HWE filter p-value threshold (variants with HWE p < this are excluded). Set to 0 to disable HWE filtering<br>_advanced_ |
| <span id="slot-callratefilter">**callRateFilter**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | Call rate filter threshold (0-1). Variants with fewer than this proportion of non-missing genotypes are excluded. Set to 0 to disable.<br>_advanced_ |
| <span id="slot-maxvariantseparation">**maxVariantSeparation**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | Maximum separation, in variants, between the two SNPs of a computed pair. Pairs further apart are not computed and not drawn, which turns the matrix from n²/2 cells into n·k and so makes the cost linear in the variant count rather than quadratic. This is plink's `--ld-window`, and like it the window is the way to look at a large region at all: the full triangle for 50,000 variants is 1.25e9 cells, which no GPU will allocate. Set to 0 for the full triangle.<br>_advanced_ |
| <span id="slot-showverticalguides">**showVerticalGuides**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Whether to show vertical guides at the connected genome positions on hover<br>_advanced_ |
| <span id="slot-showlabels">**showLabels**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Whether to show variant labels above the tick marks<br>_advanced_ |
| <span id="slot-tickheight">**tickHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>6</code> | Height of the vertical tick marks at the genomic position<br>_advanced_ |
| <span id="slot-usegenomicpositions">**useGenomicPositions**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | When true, draw cells sized according to genomic distance between SNPs rather than uniform squares<br>_advanced_ |
| <span id="slot-signedld">**signedLD**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | When true, show signed LD values (-1 to 1) instead of absolute values (0 to 1). For R², this shows R (correlation) instead. For D', this preserves the sign.<br>_advanced_ |
| <span id="slot-ldmethod">**ldMethod**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (auto, phased, composite) = <code>'auto'</code> | Which LD estimator to compute. 'auto' picks haplotypic LD for a phased callset and the Weir composite estimate for an unphased one, which is the most precise statistic each file can support. 'composite' forces the composite estimate even on phased data — the two are different statistics that coincide only under Hardy-Weinberg, so forcing it is how a phased panel is made comparable to an unphased cohort, or to plink `--r2` output. 'phased' is a preference rather than an instruction: unphased data carries no gametes to count, so it declines to composite, and `method` on the result reports what actually ran.<br>_advanced_ |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>400</code> | Starting height in pixels for the LD triangle, excluding the lineZoneHeight band; drag-resizable |
| <span class="slot-group">Inherited from [BaseLinearDisplay](../baselineardisplay)</span> | <span class="slot-group-count">7 slots</span> |
| <span id="slot-maxfeaturescreendensity">**maxFeatureScreenDensity**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | maximum features per pixel before showing a "too many features" message<br>_advanced_ |
| <span id="slot-mouseover">**mouseover**</span><br>[`string`](/docs/config_guides/slot_types#string) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>'jexl:get(feature,'_mouseOver')&#124;&#124;get(feature,'name')&#124;&#124;get(featu…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>'jexl:get(feature,'_mouseOver')&#124;&#124;get(feature,'name')&#124;&#124;get(feature,'function')&#124;&#124;get(feature,'id')'</code></pre></dialog></span> | text to display when the cursor hovers over a feature<br>_callback args:_ `feature` |
| <span id="slot-jexlfilters">**jexlFilters**</span><br>`stringArray` = <code>[]</code> | config jexlFilters are deferred evaluated so they are prepended with jexl at runtime rather than being stored with jexl in the config |
| <span id="slot-fetchsizelimit">**fetchSizeLimit**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1_000_000</code> | maximum data to attempt to download for a given track, used if adapter doesn't specify one<br>_advanced_ |
| <span id="slot-forceload">**forceLoad**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Declarative equivalent of the "Force load" button on the "too much data" banner: when true the display always renders, however large the region or dense the features. Off by default (the gate guards against huge downloads). Set it on a view no one can interact with — an embedded / notebook view, or a screenshot — where the region is known and you want it drawn without a click.<br>_advanced_ |
| <span id="slot-densitytier">**densityTier**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (auto, features, density) = <code>'auto'</code> | when to draw the features-per-bin density band in place of features: "auto" swaps to it where the region is too large to fetch, "features" never does and keeps the banner, "density" always does. Needs a density source on the adapter (its densityAdapter slot)<br>_advanced_ |
| <span id="slot-densitytierbpperpx">**densityTierBpPerPx**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | in "auto" mode, also draw the density band from this many bp per pixel outward, before the region is too large to fetch; 0 leaves the swap to the fetch-size gate alone<br>_advanced_ |
