---
id: linearmanhattandisplay
title: LinearManhattanDisplay
sidebar_label: Display -> LinearManhattanDisplay
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `gwas` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gwas/src/LinearManhattanDisplay/configSchemaFactory.ts).

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

Taller track, LocusZoom-style coloring: `colorBy: 'ld'` colors each point by its
r² to the index SNP read from the adapter's `ldAdapter` sub-adapter. The LD data
is a second source on `GWASAdapter` (mirroring MAF's `annotationAdapter`), so it
nests under `adapter`, while display-only options like `height`/`colorBy` go in
`displayDefaults` — see
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
- **Base config:** [LinearWiggleDisplay](../linearwiggledisplay)

## Config slots

These slots go on a display entry:
`"displays": [{ "type": "LinearManhattanDisplay", ... }]`, or in the track's
[`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this
is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained
in the [config slot types reference](/docs/config_guides/slot_types). Slots a
base configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description | From |
| --- | --- | --- |
| <span id="slot-color">**color**</span><br>[`color`](/docs/config_guides/slot_types#color) = <code>'#0068d1'</code> | CSS color or jexl callback for Manhattan points |  |
| <span id="slot-colorby">**colorBy**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (normal, ld) = <code>'normal'</code> | LocusZoom-style coloring. 'normal' uses `color`; 'ld' colors each point by its r² to the index SNP, read from the `GWASAdapter`'s `ldAdapter` sub-adapter. |  |
| <span id="slot-scatterpointsize">**scatterPointSize**</span><br>`maybeNumber` = <code>DEFAULT_POINT_DIAMETER_PX</code> _promotable_ | Manhattan point diameter in px (adjustable from the track menu). Larger default than wiggle's since Manhattan points are the primary glyph. |  |
| <span id="slot-defaultrendering">**defaultRendering**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (xyplot, density, line, linecenter, scatter) = <code>'xyplot'</code> | Default rendering type: `xyplot`, `density`, `line`, `linecenter`, or `scatter`.<br><span class="cell-more"><button type="button" class="cell-more-trigger">example</button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{&#10;&#160;&#160;"type": "LinearWiggleDisplay",&#10;&#160;&#160;"defaultRendering": "density"&#10;}</code></pre></dialog></span> | [LinearWiggleDisplay](../linearwiggledisplay) |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>100</code> | Default height of the track | [LinearWiggleDisplay](../linearwiggledisplay) |
| <span id="slot-usebicolor">**useBicolor**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | When true (the default), positive scores use posColor and negative use negColor; when false, all bars use the single color slot. Setting color alone, with no posColor/negColor/useBicolor, turns this off for you. | [LinearWiggleDisplay](../linearwiggledisplay) |
| <span id="slot-minimalticks">**minimalTicks**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Draw only the min/max Y-axis ticks<br>_advanced_ | [LinearWiggleDisplay](../linearwiggledisplay) |
| <span id="slot-summaryscoremode">**summaryScoreMode**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (max, min, avg, whiskers) = <code>'whiskers'</code> | choose whether to use max/min/average or whiskers which combines all three into the same rendering | [LinearWiggleDisplay](../linearwiggledisplay) |
| <span id="slot-poscolor">**posColor**</span><br>[`color`](/docs/config_guides/slot_types#color) = <code>'#0068d1'</code> | Fill color for positive scores, used when useBicolor is true (the default) | [LinearWiggleDisplay](../linearwiggledisplay) |
| <span id="slot-negcolor">**negColor**</span><br>[`color`](/docs/config_guides/slot_types#color) = <code>'#e01e26'</code> | Fill color for negative scores, used when useBicolor is true (the default) | [LinearWiggleDisplay](../linearwiggledisplay) |
| <span id="slot-bicolorpivot">**bicolorPivot**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | Pivot value for bicolor mode<br>_advanced_ | [LinearWiggleDisplay](../linearwiggledisplay) |
| <span id="slot-minscore">**minScore**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>Number.MIN_VALUE</code> | Fixed minimum score bound. The default (Number.MIN_VALUE) is a sentinel meaning "unset, use autoscale"<br>_advanced_ | [LinearWiggleDisplay](../linearwiggledisplay) |
| <span id="slot-maxscore">**maxScore**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>Number.MAX_VALUE</code> | Fixed maximum score bound. The default (Number.MAX_VALUE) is a sentinel meaning "unset, use autoscale"<br>_advanced_ | [LinearWiggleDisplay](../linearwiggledisplay) |
| <span id="slot-scaletype">**scaleType**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (linear, log) = <code>'linear'</code> | Scale type (linear or log) | [LinearWiggleDisplay](../linearwiggledisplay) |
| <span id="slot-autoscale">**autoscale**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (local, localsd, localpercentile) = <code>'localpercentile'</code> | Autoscale type: "local" uses the min/max in the visible region, "localsd" uses mean ± numStdDev standard deviations, "localpercentile" uses the numQuantile-th percentile score as the max (robust to skewed/peaky data) | [LinearWiggleDisplay](../linearwiggledisplay) |
| <span id="slot-numstddev">**numStdDev**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>3</code> | Number of standard deviations to use for the localsd autoscale type<br>_advanced_ | [LinearWiggleDisplay](../linearwiggledisplay) |
| <span id="slot-numquantile">**numQuantile**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0.99</code> | Percentile used to clip outliers for the localpercentile autoscale type (e.g. 0.99 clips the outermost 1% of each sign). Positive and negative extents are computed independently and anchored at 0, so a sparse minority tail (e.g. phyloP acceleration) stays visible; all-positive data pins the min at 0<br>_advanced_ | [LinearWiggleDisplay](../linearwiggledisplay) |
| <span id="slot-linewidth">**lineWidth**</span><br>`maybeNumber` = <code>1</code> _promotable_ | Line thickness in px for line ("line"/"multiline") rendering. Unset (the default) follows the session-wide default for this display type, falling back to 1<br>_advanced_ | [LinearWiggleDisplay](../linearwiggledisplay) |
