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
| <span id="slot-summaryscoremode">**summaryScoreMode**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (max, min, avg, whiskers) = <code>'avg'</code> | GCContentAdapter never emits real per-bin min/max, so the inherited 'whiskers' default has no summary to draw — it just forces the above-origin colour on every bin (buildSourceRenderData skips the two-sided split for whiskers) and hides negative GC-skew as if it were positive |
| <span class="slot-group">Inherited from [LinearWiggleDisplay](../linearwiggledisplay)</span> | <span class="slot-group-count">19 slots</span> |
| <span id="slot-defaultrendering">**defaultRendering**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (xyplot, density, line, linecenter, scatter) = <code>'xyplot'</code> | Default rendering type: `xyplot`, `density`, `line`, `linecenter`, or `scatter`.<br><span class="cell-more"><button type="button" class="cell-more-trigger">example</button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{&#10;&#160;&#160;"type": "LinearWiggleDisplay",&#10;&#160;&#160;"defaultRendering": "density"&#10;}</code></pre></dialog></span> |
| <span id="slot-facet">**facet**</span><br>[Facet](../facet) | One row per value of a field, stacked down the track with a label, a separator and the clustering sidebar. `source` — one row per subtrack — is the only field this display reads; leave it unset and every source is drawn in one shared plot. `domain` is the row order: the subtracks it names lead, the rest keep the adapter's order, and a clustering run rotates its dendrogram towards it rather than discarding it.<br><span class="cell-more"><button type="button" class="cell-more-trigger">example</button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{&#10;&#160;&#160;"type": "LinearWiggleDisplay",&#10;&#160;&#160;"facet": "source"&#10;}</code></pre></dialog></span> |
| <span id="slot-color">**color**</span><br>[WiggleColor](../wigglecolor) | One CSS colour, or a field through a scale — `score` through `threshold` for the bicolor plot, through `linear` or `log` for the density ramp, `source` through `categorical` for a palette entry per subtrack. Unset, the layout decides: several sources in one plot box take a palette entry each, and anything else is the pos/neg pair about the `origin`.<br><span class="cell-more"><button type="button" class="cell-more-trigger">example</button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{&#10;&#160;&#160;"type": "LinearWiggleDisplay",&#10;&#160;&#160;"color": { "field": "score", "scale": "threshold", "domain": [2] }&#10;}</code></pre></dialog></span> |
| <span id="slot-scales">**scales**</span><br>[ValueScale](../valuescale) | The y scale the plot is drawn through: `type`, `domainMin`, `domainMax`, `autoscale`, `numStdDev`, `numQuantile`, `symlogConstant` and `rules`, the reference lines drawn across it. The density rendering draws no rule and does not widen to one: it spends colour on the score and has no axis to rule.<br><span class="cell-more"><button type="button" class="cell-more-trigger">example</button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{&#10;&#160;&#160;"type": "LinearWiggleDisplay",&#10;&#160;&#160;"scales": { "y": { "rules": [{ "value": 30, "label": "2 copies" }, 15] } }&#10;}</code></pre></dialog></span> |
| <span id="slot-showlegend">**showLegend**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Draw the key: density's score color ramp, or the source colors where several share one plot. Defaults to on |
| <span id="slot-minimalticks">**minimalTicks**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Draw only the min/max Y-axis ticks<br>_advanced_ |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>100</code> | default height for the track |
| <span id="slot-scorefield">**scoreField**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'score'</code> | Feature field plotted on the score axis, read natively off each feature. The default `score` is the field every adapter serves — including the value a BED adapter's `scoreColumn` rewrote it to — so an explicit name here reaches a raw column the adapter left alone (a BED extra column, a GFF attribute) and takes precedence over that adapter-tier rewrite. The Manhattan plot skips a feature with no finite value in the field; the wiggle renderings plot it at 0 |
| <span id="slot-displaycrosshatches">**displayCrossHatches**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Rule the score axis with horizontal cross hatches at the tick positions — the config form of the score menu's "Show cross hatches". Ignored by the density rendering types, which spend color rather than height on the score and so have no axis to rule |
| <span id="slot-resolution">**resolution**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | how many points per pixel the fetch asks a tiered file for: 1 is one per pixel, larger is finer and smaller is coarser. Clamped to the range the Resolution menu offers, so a value outside it reads as the nearest end |
| <span id="slot-origin">**origin**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | The value bars grow from, and what a color scale reads where its own domain or domainMid is empty. The same slot, with the same meaning, as the mark display's origin |
| <span id="slot-scatterpointsize">**scatterPointSize**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>2</code> | Point height in px for scatterplot rendering. Defaults to 2<br>_advanced_ |
| <span id="slot-linewidth">**lineWidth**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | Line thickness in px for line rendering. Defaults to 1<br>_advanced_ |
| <span id="slot-maxgapmultiple">**maxGapMultiple**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | Interpolated line only: break the line where consecutive points sit further apart than this multiple of the track's own mean point spacing, instead of drawing one long chord across the hole. Scaled to the data rather than a fixed bp distance so it holds at every zoom. 0 disables breaking (the pre-existing behavior, one connected line throughout)<br>_advanced_ |
| <span id="slot-showtree">**showTree**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Show the subtrack clustering tree in the sidebar |
| <span id="slot-showbranchlength">**showBranchLength**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | position tree nodes by branch length (dendrogram) rather than evenly by topology (cladogram) |
| <span id="slot-showrowlabels">**showRowLabels**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Name each subtrack row down the left edge |
| <span id="slot-treeareawidth">**treeAreaWidth**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>80</code> | width in px of the tree sidebar, which a drag on its edge also writes |
| <span id="slot-showrowseparators">**showRowSeparators**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | draw a hairline between adjacent rows; off by default, because a painting whose neighbouring rows differ in color already separates itself and the line only earns its pixel where they do not — a run of same-colored rows reads as one block without it, with no way to recover the row count by eye. Drawn only once rows are at least 4px tall: below that the line is as thick as the row it borders, turning a dense painting into a grid of hairlines with a little color between them |
