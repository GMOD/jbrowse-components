---
id: multilinearwiggledisplay
title: MultiLinearWiggleDisplay
sidebar_label: Display -> MultiLinearWiggleDisplay
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `wiggle` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/MultiLinearWiggleDisplay/configSchema.ts).

## Example usage

Minimal `MultiQuantitativeTrack` config. See the
[multi-quantitative track guide](/docs/config_guides/multiquantitative_track)
for all adapter and display options:

```js
{
  type: 'MultiQuantitativeTrack',
  trackId: 'coverage_by_sample',
  name: 'Coverage by sample',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'MultiWiggleAdapter',
    bigWigs: [
      'https://example.com/sample1.bw',
      'https://example.com/sample2.bw',
    ],
  },
}
```

Taller track overlaying two samples in one shared plot (`multixyplot`)
instead of the default stacked-per-subtrack layout:

```js
{
  type: 'MultiQuantitativeTrack',
  trackId: 'coverage_by_sample',
  name: 'Coverage by sample',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'MultiWiggleAdapter',
    bigWigs: [
      'https://example.com/sample1.bw',
      'https://example.com/sample2.bw',
    ],
  },
  displayDefaults: { height: 300, defaultRendering: 'multixyplot' },
}
```

_See the **Config slots** section below for all available configuration fields._

configuration for the multi-wiggle display, which draws several quantitative
subtracks (e.g. BigWig files) on a shared Y axis

These are display-level slots: set them inside a track's `displays` to
change its defaults (setting them at the track top level has no effect).
The object shorthand `displayDefaults: { key: value }` is equivalent to the
full `displays: [{ type: 'MultiLinearWiggleDisplay', displayId: '...', key: value }]`
array form — see
[configuring displays](/docs/config_guides/tracks#configuring-displays).

Per-subtrack metadata (a `name`, `color`, and `group` for each subtrack) is
preloaded on the *adapter*, not here — use `MultiWiggleAdapter`'s
`subadapters` slot, where `group` drives the sidebar clustering tree and
`color` sets each subtrack's line/fill.

## Related links

- **Adapter:** [MultiWiggleAdapter](../multiwiggleadapter)
- **State model:** [runtime API](../../models/multilinearwiggledisplay)

## Config slots

These slots go on a display entry: `"displays": [{ "type": "MultiLinearWiggleDisplay", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>200</code> | Default height of the track |
| <span id="slot-defaultrendering">**defaultRendering**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (multirowxy, multirowdensity, multirowline, multirowlinecenter, multirowscatter, multixyplot, multiline, multilinecenter, multiscatter) = <code>'multirowxy'</code> | Default rendering type. Multi-row modes (`multirowxy`, `multirowdensity`, `multirowline`, `multirowlinecenter`, `multirowscatter`) draw one stacked plot per subtrack; overlapping modes (`multixyplot`, `multiline`, `multilinecenter`, `multiscatter`) draw all subtracks together in one shared plot.<br><span class="cell-more"><button type="button" class="cell-more-trigger">example</button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{&#10;&#160;&#160;"type": "MultiLinearWiggleDisplay",&#10;&#160;&#160;"defaultRendering": "multixyplot"&#10;}</code></pre></dialog></span> |
| <span id="slot-minimalticks">**minimalTicks**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Draw only the min/max Y-axis ticks<br>_advanced_ |
| <span id="slot-showlegend">**showLegend**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) = <code>true</code> _promotable_ | Draw the source color key in overlay mode. Unset (the default) follows the session-wide default for this display type, falling back to on; an explicit true/false customizes the track |
| <span id="slot-minscore">**minScore**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>Number.MIN_VALUE</code> | Fixed minimum score bound. The default (Number.MIN_VALUE) is a sentinel meaning "unset, use autoscale"<br>_advanced_ |
| <span id="slot-maxscore">**maxScore**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>Number.MAX_VALUE</code> | Fixed maximum score bound. The default (Number.MAX_VALUE) is a sentinel meaning "unset, use autoscale"<br>_advanced_ |
| <span id="slot-scaletype">**scaleType**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (linear, log, symlog) = <code>'linear'</code> | Scale type. "log" cannot represent 0 or negative scores and floors the domain above them; "symlog" is log-like away from zero and linear through it, so a track whose scores touch or cross 0 keeps them |
| <span id="slot-autoscale">**autoscale**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (local, localsd, localpercentile) = <code>'localpercentile'</code> | Autoscale type: "local" uses the min/max in the visible region, "localsd" uses mean ± numStdDev standard deviations, "localpercentile" uses the numQuantile-th percentile score as the max (robust to skewed/peaky data) |
| <span id="slot-numstddev">**numStdDev**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>3</code> | Number of standard deviations to use for the localsd autoscale type<br>_advanced_ |
| <span id="slot-displaycrosshatches">**displayCrossHatches**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Rule the score axis with horizontal cross hatches at the tick positions — the config form of the score menu's "Show cross hatches". Ignored by the density rendering types, which spend color rather than height on the score and so have no axis to rule |
| <span id="slot-symlogconstant">**symlogConstant**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | Width of symlog's linear region around zero. The default 0 means "derive from the domain" (a thousandth of its largest magnitude). Setting it to 1 makes symlog exactly log(x+1), which flattens anything living below 1 — set it near the smallest score you need to tell apart instead<br>_advanced_ |
| <span id="slot-poscolor">**posColor**</span><br>[`color`](/docs/config_guides/slot_types#color) = <code>'#0068d1'</code> | Fill color for positive scores, used when useBicolor is true (the default) |
| <span id="slot-negcolor">**negColor**</span><br>[`color`](/docs/config_guides/slot_types#color) = <code>'#e01e26'</code> | Fill color for negative scores, used when useBicolor is true (the default) |
| <span id="slot-bicolorpivot">**bicolorPivot**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | Pivot value for bicolor mode<br>_advanced_ |
| <span id="slot-densitycolorramp">**densityColorRamp**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) = <code>'default'</code> | Color ramp for density ("density"/"multirowdensity") rendering. "default" fades from white at the pivot to the track color; a named ramp (e.g. "viridis") colors scores through that fixed 256-entry lookup table instead, the same table the Hi-C viridis scheme uses<br>_advanced_ |
| <span id="slot-numquantile">**numQuantile**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0.99</code> | Percentile used to clip outliers for the localpercentile autoscale type (e.g. 0.99 clips the outermost 1% of each sign). Positive and negative extents are computed independently and anchored at 0, so a sparse minority tail (e.g. phyloP acceleration) stays visible; all-positive data pins the min at 0<br>_advanced_ |
| <span id="slot-scatterpointsize">**scatterPointSize**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) = <code>2</code> _promotable_ | Point height in px for scatterplot ("scatter"/"multiscatter") rendering. Unset (the default) follows the session-wide default for this display type, falling back to 2<br>_advanced_ |
| <span id="slot-linewidth">**lineWidth**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) = <code>1</code> _promotable_ | Line thickness in px for line ("line"/"multiline") rendering. Unset (the default) follows the session-wide default for this display type, falling back to 1<br>_advanced_ |
| <span id="slot-maxgapmultiple">**maxGapMultiple**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | Interpolated line ("linecenter"/"multilinecenter"/"multirowlinecenter") only: break the line where consecutive points sit further apart than this multiple of the track's own mean point spacing, instead of drawing one long chord across the hole. Scaled to the data rather than a fixed bp distance so it holds at every zoom. 0 disables breaking (the pre-existing behavior, one connected line throughout)<br>_advanced_ |
| <span id="slot-summaryscoremode">**summaryScoreMode**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (max, min, avg, whiskers) = <code>'avg'</code> | choose whether to use max/min/average or whiskers which combines all three into the same rendering |
| <span id="slot-showtree">**showTree**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Show the subtrack clustering tree in the sidebar |
| <span id="slot-showbranchlength">**showBranchLength**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | position tree nodes by branch length (dendrogram) rather than evenly by topology (cladogram) |
| <span id="slot-showrowlabels">**showRowLabels**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Name each subtrack row down the left edge |
| <span id="slot-showrowseparators">**showRowSeparators**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | draw a hairline between adjacent rows; off by default, because a painting whose neighbouring rows differ in color already separates itself and the line only earns its pixel where they do not — a run of same-colored rows reads as one block without it, with no way to recover the row count by eye. Drawn only once rows are at least 4px tall: below that the line is as thick as the row it borders, turning a dense painting into a grid of hairlines with a little color between them |
| <span id="slot-fetchsizelimit">**fetchSizeLimit**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1_000_000</code> | maximum data to attempt to download for a given track, used if adapter doesn't specify one<br>_advanced_ |
| <span id="slot-forceload">**forceLoad**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Declarative equivalent of the "Force load" button on the "too much data" banner: when true the display always renders, however large the region or dense the features. Off by default (the gate guards against huge downloads). Set it on a view no one can interact with — an embedded / notebook view, or a screenshot — where the region is known and you want it drawn without a click.<br>_advanced_ |
