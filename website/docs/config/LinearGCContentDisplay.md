---
id: lineargccontentdisplay
title: LinearGCContentDisplay
sidebar_label: Display -> LinearGCContentDisplay
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `gccontent` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gccontent/src/LinearGCContentDisplay/configSchemaReferenceSequence.ts).

## Example usage

Added to the assembly's `sequence` track, which is where a
`ReferenceSequenceTrack` is authored. `gcMode` is `content` for GC percentage
or `skew` for (G-C)/(G+C):
```js
sequence: {
  type: 'ReferenceSequenceTrack',
  trackId: 'refseq',
  adapter: {
    type: 'IndexedFastaAdapter',
    uri: 'https://example.com/genome.fa',
  },
  displays: [
    {
      type: 'LinearGCContentDisplay',
      displayId: 'refseq-LinearGCContentDisplay',
      windowSize: 100,
      windowDelta: 100,
      gcMode: 'content',
    },
  ],
}
```

_See the **Config slots** section below for all available configuration fields._

GC content computed from a `ReferenceSequenceTrack`'s own sequence adapter, so
there is no second adapter to configure. Use a `GCContentTrack` with
[](/docs/config/lineargccontenttrackdisplay) instead when GC should be its own
track rather than a display on the sequence.

Every slot comes from the shared base below; this display adds none of its
own.

## Related links

- **Adapter:** [BgzipFastaAdapter](../bgzipfastaadapter)
- **Adapter:** [ChromSizesAdapter](../chromsizesadapter)
- **Adapter:** [FromConfigRegionsAdapter](../fromconfigregionsadapter)
- **Adapter:** [FromConfigSequenceAdapter](../fromconfigsequenceadapter)
- **Adapter:** [IndexedFastaAdapter](../indexedfastaadapter)
- **Adapter:** [TwoBitAdapter](../twobitadapter)
- **Adapter:** [UnindexedFastaAdapter](../unindexedfastaadapter)
- **State model:** [runtime API](../../models/lineargccontentdisplay)
- **Base config:** [SharedGCContentDisplay](../sharedgccontentdisplay)

## Config slots

These slots go on a display entry: `"displays": [{ "type": "LinearGCContentDisplay", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span class="slot-group">Inherited from [SharedGCContentDisplay](../sharedgccontentdisplay)</span> | <span class="slot-group-count">4 slots</span> |
| <span id="slot-windowsize">**windowSize**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>100</code> | Number of bases per GC measurement window. |
| <span id="slot-windowdelta">**windowDelta**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>100</code> | Step between successive windows; smaller than `windowSize` means overlapping windows (a smoother signal). |
| <span id="slot-gcmode">**gcMode**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (content, skew) = <code>'content'</code> | `content` for GC percentage, `skew` for (G-C)/(G+C) strand skew. |
| <span id="slot-summaryscoremode">**summaryScoreMode**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (max, min, avg, whiskers) = <code>'avg'</code> | GCContentAdapter never emits real per-bin min/max, so the inherited 'whiskers' default has no summary to draw — it just forces posColor-only rendering (buildSourceRenderData skips the bicolor pos/neg split for whiskers) and hides negative GC-skew as if it were positive |
| <span class="slot-group">Inherited from [LinearWiggleDisplay](../linearwiggledisplay)</span> | <span class="slot-group-count">23 slots</span> |
| <span id="slot-defaultrendering">**defaultRendering**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (xyplot, density, line, linecenter, scatter) = <code>'xyplot'</code> | Default rendering type: `xyplot`, `density`, `line`, `linecenter`, or `scatter`.<br><span class="cell-more"><button type="button" class="cell-more-trigger">example</button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{&#10;&#160;&#160;"type": "LinearWiggleDisplay",&#10;&#160;&#160;"defaultRendering": "density"&#10;}</code></pre></dialog></span> |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>100</code> | Default height of the track |
| <span id="slot-usebicolor">**useBicolor**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | When true (the default), positive scores use posColor and negative use negColor; when false, all bars use the single color slot. Setting color alone, with no posColor/negColor/useBicolor, turns this off for you. |
| <span id="slot-color">**color**</span><br>[`color`](/docs/config_guides/slot_types#color) = <code>'#0068d1'</code> | Single fill CSS color for the wiggle bars; a wiggle colors per signal, not per feature, so jexl callbacks do not apply. Set alone it implies useBicolor false; alongside posColor/negColor it goes unused. Density rendering always draws from posColor. |
| <span id="slot-scorerules">**scoreRules**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>[]</code> | Not in the shared wiggle fields: `MultiLinearWiggleDisplay` spreads those and stacks a plot box per row, so one rule list has no single axis to sit on there. |
| <span id="slot-minimalticks">**minimalTicks**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Draw only the min/max Y-axis ticks<br>_advanced_ |
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
| <span id="slot-fetchsizelimit">**fetchSizeLimit**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1_000_000</code> | maximum data to attempt to download for a given track, used if adapter doesn't specify one<br>_advanced_ |
| <span id="slot-forceload">**forceLoad**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Declarative equivalent of the "Force load" button on the "too much data" banner: when true the display always renders, however large the region or dense the features. Off by default (the gate guards against huge downloads). Set it on a view no one can interact with — an embedded / notebook view, or a screenshot — where the region is known and you want it drawn without a click.<br>_advanced_ |
