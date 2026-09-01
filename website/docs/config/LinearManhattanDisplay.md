---
id: linearmanhattandisplay
title: LinearManhattanDisplay
sidebar_label: Display -> LinearManhattanDisplay
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `gwas` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gwas/src/LinearManhattanDisplay/configSchemaFactory.ts).

## Example usage

Minimal `GWASTrack` config. See the
[GWAS track guide](/docs/config_guides/gwas_track) for all options:

```js
{
  type: 'GWASTrack',
  trackId: 'gwas',
  name: 'GWAS results',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'GWASAdapter',
    uri: 'https://example.com/gwas.bed.gz',
  },
}
```

Taller track, LocusZoom-style coloring: `colorBy: 'ld'` colors each point by
its r² to the index SNP read from the adapter's `ldAdapter` sub-adapter. The
LD data is a second source on `GWASAdapter` (mirroring MAF's
`annotationAdapter`), so it nests under `adapter`, while display-only options
like `height`/`colorBy` go in `displayDefaults` — see
[configuring displays](/docs/config_guides/tracks#configuring-displays):

```js
{
  type: 'GWASTrack',
  trackId: 'gwas',
  name: 'GWAS results',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'GWASAdapter',
    uri: 'https://example.com/gwas.bed.gz',
    ldAdapter: {
      type: 'PlinkLDTabixAdapter',
      uri: 'https://example.com/plink.ld.gz',
    },
  },
  displayDefaults: {
    height: 400,
    colorBy: 'ld',
  },
}
```

_See the **Config slots** section below for all available configuration fields._

configuration for the Manhattan plot display used by GWAS tracks

## Related links

- **Adapter:** [GWASAdapter](../gwasadapter)
- **State model:** [runtime API](../../models/linearmanhattandisplay)
- **Base config:** [BaseLinearDisplay](../baselineardisplay)

## Config slots

These slots go on a display entry: `"displays": [{ "type": "LinearManhattanDisplay", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-color">**color**</span><br>[`color`](/docs/config_guides/slot_types#color) = <code>'#0068d1'</code> | CSS color or jexl callback for Manhattan points<br>_callback args:_ `feature` |
| <span id="slot-colorby">**colorBy**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (normal, ld) = <code>'normal'</code> | LocusZoom-style coloring. 'normal' uses `color`; 'ld' colors each point by its r² to the index SNP, read from the `GWASAdapter`'s `ldAdapter` sub-adapter. |
| <span id="slot-significanceline">**significanceLine**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | Draw a horizontal line across the plot at this score, for the threshold a scan is read against: genome-wide significance on a GWAS, or an empirical outlier cutoff on a differentiation scan. Unset (the default) draws none, since there is no threshold that is right for every scan.<br><br>On the plot's own scale, so it is a `-log10(p)` where the points are and an Fst where `scoreColumn` names an Fst column. The autoscaled y-axis widens to reach it, so a window where nothing clears the threshold still shows the threshold; an explicit `minScore`/`maxScore` that excludes it still wins, and there the line is not drawn. |
| <span id="slot-minimalticks">**minimalTicks**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Draw only the min/max Y-axis ticks<br>_advanced_ |
| <span id="slot-scatterpointsize">**scatterPointSize**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) = <code>4</code> _promotable_ | Manhattan point diameter in px (adjustable from the track menu). Larger default than wiggle's since Manhattan points are the primary glyph. |
| <span id="slot-showldlegend">**showLdLegend**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) = <code>true</code> _promotable_ | Draw the LD color key, which labels the r² ramp the points are painted against. Only appears while LD coloring is active — the ramp means nothing under the plain single-color scheme. |
| <span id="slot-minscore">**minScore**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>Number.MIN_VALUE</code> | Fixed minimum score bound. The default (Number.MIN_VALUE) is a sentinel meaning "unset, use autoscale"<br>_advanced_ |
| <span id="slot-maxscore">**maxScore**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>Number.MAX_VALUE</code> | Fixed maximum score bound. The default (Number.MAX_VALUE) is a sentinel meaning "unset, use autoscale"<br>_advanced_ |
| <span id="slot-scaletype">**scaleType**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (linear, log) = <code>'linear'</code> | Scale type (linear or log) |
| <span id="slot-autoscale">**autoscale**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (local, localsd, localpercentile) = <code>'localpercentile'</code> | Autoscale type: "local" uses the min/max in the visible region, "localsd" uses mean ± numStdDev standard deviations, "localpercentile" uses the numQuantile-th percentile score as the max (robust to skewed/peaky data) |
| <span id="slot-numstddev">**numStdDev**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>3</code> | Number of standard deviations to use for the localsd autoscale type<br>_advanced_ |
| <span id="slot-displaycrosshatches">**displayCrossHatches**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Rule the score axis with horizontal cross hatches at the tick positions — the config form of the score menu's "Show cross hatches". Ignored by the density rendering types, which spend color rather than height on the score and so have no axis to rule |
| <span class="slot-group">Inherited from [BaseLinearDisplay](../baselineardisplay)</span> | <span class="slot-group-count">8 slots</span> |
| <span id="slot-maxfeaturescreendensity">**maxFeatureScreenDensity**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | maximum features per pixel before showing a "too many features" message<br>_advanced_ |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>100</code> | default height for the track |
| <span id="slot-mouseover">**mouseover**</span><br>[`string`](/docs/config_guides/slot_types#string) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>'jexl:get(feature,'_mouseOver')&#124;&#124;get(feature,'name')&#124;&#124;get(featu…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>'jexl:get(feature,'_mouseOver')&#124;&#124;get(feature,'name')&#124;&#124;get(feature,'function')&#124;&#124;get(feature,'id')'</code></pre></dialog></span> | text to display when the cursor hovers over a feature<br>_callback args:_ `feature` |
| <span id="slot-jexlfilters">**jexlFilters**</span><br>`stringArray` = <code>[]</code> | config jexlFilters are deferred evaluated so they are prepended with jexl at runtime rather than being stored with jexl in the config |
| <span id="slot-fetchsizelimit">**fetchSizeLimit**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1_000_000</code> | maximum data to attempt to download for a given track, used if adapter doesn't specify one<br>_advanced_ |
| <span id="slot-forceload">**forceLoad**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Declarative equivalent of the "Force load" button on the "too much data" banner: when true the display always renders, however large the region or dense the features. Off by default (the gate guards against huge downloads). Set it on a view no one can interact with — an embedded / notebook view, or a screenshot — where the region is known and you want it drawn without a click.<br>_advanced_ |
| <span id="slot-densitytier">**densityTier**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (auto, features, density) = <code>'auto'</code> | when to draw the features-per-bin density band in place of features: "auto" swaps to it where the region is too large to fetch, "features" never does and keeps the banner, "density" always does. Needs a density source on the adapter (its densityAdapter slot)<br>_advanced_ |
| <span id="slot-densitytierbpperpx">**densityTierBpPerPx**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | in "auto" mode, also draw the density band from this many bp per pixel outward, before the region is too large to fetch; 0 leaves the swap to the fetch-size gate alone<br>_advanced_ |
