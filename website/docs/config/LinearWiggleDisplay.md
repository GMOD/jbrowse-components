---
id: linearwiggledisplay
title: LinearWiggleDisplay
description: "configuration for the quantitative display: an XY plot, density, line or scatter rendering of one source or of many, with rows: 'source' giving each source a row of its own"
sidebar_label: Display -> LinearWiggleDisplay
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `wiggle` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/LinearWiggleDisplay/configSchema.ts).

## Example usage

Minimal `QuantitativeTrack` config. See the
[quantitative track guide](/docs/config_guides/quantitative_track) for all
adapter and display options:

```js
{
  type: 'QuantitativeTrack',
  trackId: 'coverage',
  name: 'Coverage',
  assemblyNames: ['hg38'],
  adapter: { type: 'BigWigAdapter', uri: 'https://example.com/coverage.bw' },
}
```

Several bigWigs, which a `MultiQuantitativeTrack` stacks one per row:

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

Taller track, log scale, custom color:

```js
{
  type: 'QuantitativeTrack',
  trackId: 'coverage',
  name: 'Coverage',
  assemblyNames: ['hg38'],
  adapter: { type: 'BigWigAdapter', uri: 'https://example.com/coverage.bw' },
  displayDefaults: {
    height: 200,
    scales: { y: { type: 'log' } },
    color: 'darkgreen',
  },
}
```

_See the **Config slots** section below for all available configuration fields._

configuration for the quantitative display: an XY plot, density, line or
scatter rendering of one source or of many, with `rows: 'source'` giving
each source a row of its own

Per-source metadata (a `name`, `color` and `group` for each) is preloaded on
the *adapter* rather than here — see `MultiWiggleAdapter`'s `subadapters`
slot, where `group` drives the sidebar clustering tree and `color` sets each
source's line or fill.

These are display-level slots: set them inside a track's `displays` to
change its defaults (setting them at the track top level has no effect).
The object shorthand `displayDefaults: { key: value }` is equivalent to the
full `displays: [{ type: 'LinearWiggleDisplay', displayId: '...', key: value }]`
array form — see
[configuring displays](/docs/config_guides/tracks#configuring-displays).

## Related links

- **Adapter:** [BedGraphAdapter](../bedgraphadapter)
- **Adapter:** [BedGraphTabixAdapter](../bedgraphtabixadapter)
- **Adapter:** [BigWigAdapter](../bigwigadapter)
- **State model:** [runtime API](../../models/linearwiggledisplay)

## Config slots

These slots go on a display entry: `"displays": [{ "type": "LinearWiggleDisplay", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-mark">**mark**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (bar, point, line, span) = <code>'bar'</code> | What each score is drawn as, in the mark display's words: `bar`, a bar from the `origin` to the score; `point`, a point at it; `line`, a line through the scores; `span`, a strip whose color is the score. The track menu's Plot type writes it. v4's `defaultRendering` loads as its `mark`: `xyplot` a bar, `scatter` a point, `density` a span, and `line` and `linecenter` a line.<br><span class="cell-more"><button type="button" class="cell-more-trigger">example</button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{&#10;&#160;&#160;"type": "LinearWiggleDisplay",&#10;&#160;&#160;"mark": "span"&#10;}</code></pre></dialog></span> |
| <span id="slot-interpolate">**interpolate**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (step, linear) = <code>'step'</code> | How a `line` joins its scores: `step` holds each across its bin, as the data says; `linear` runs from one bin's centre to the next, smoother where the bins are few. Read by a line alone. |
| <span id="slot-rows">**rows**</span><br>[QuantitativeRows](../quantitativerows) | One row per value of a field, stacked down the track with a label, a separator and the clustering sidebar, and the arrangement a reader gives them. `source` — one row per subtrack — is the only field this display reads; leave it unset and every source is drawn in one shared plot. `domain` is the row order: the subtracks it names lead, the rest keep the adapter's order, and a clustering run rotates its dendrogram towards it rather than discarding it. `labels`, `tree`, `treeProvenance` and `kept` are what the arrangement dialog, a clustering run and a focus write, each as a session edit to this object.<br><span class="cell-more"><button type="button" class="cell-more-trigger">example</button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{&#10;&#160;&#160;"type": "LinearWiggleDisplay",&#10;&#160;&#160;"rows": "source"&#10;}</code></pre></dialog></span> |
| <span id="slot-rowcolor">**rowColor**</span><br>[RowColor](../rowcolor) | The color a reader set on a named subtrack, as `domain`/`range` pairs: its plot, or under a score gradient the tint beside its label, ahead of the adapter's color and the palette.<br><span class="cell-more"><button type="button" class="cell-more-trigger">example</button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{&#10;&#160;&#160;"type": "LinearWiggleDisplay",&#10;&#160;&#160;"rowColor": { "domain": ["tumor"], "range": ["#b2182b"] }&#10;}</code></pre></dialog></span> |
| <span id="slot-color">**color**</span><br>[WiggleColor](../wigglecolor) | One CSS color, or `score` through a scale — `threshold` for the bicolor plot, `linear` for the density ramp. Unset, it is the pos/neg pair about the `origin`, and several sources in one plot box each paint their row color.<br><span class="cell-more"><button type="button" class="cell-more-trigger">example</button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{&#10;&#160;&#160;"type": "LinearWiggleDisplay",&#10;&#160;&#160;"color": { "field": "score", "scale": "threshold", "domain": [2] }&#10;}</code></pre></dialog></span> |
| <span id="slot-scales">**scales**</span><br>[ValueScale](../valuescale) | The y scale the plot is drawn through: `type`, `domainMin`, `domainMax`, `domainQuantile`, `symlogConstant` and `rules`, the reference lines drawn across it. The density rendering draws no rule and does not widen to one: it spends color on the score and has no axis to rule.<br><span class="cell-more"><button type="button" class="cell-more-trigger">example</button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{&#10;&#160;&#160;"type": "LinearWiggleDisplay",&#10;&#160;&#160;"scales": { "y": { "rules": [{ "value": 30, "label": "2 copies" }, 15] } }&#10;}</code></pre></dialog></span> |
| <span id="slot-showlegend">**showLegend**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Draw the key: density's score color ramp, or the source colors where several share one plot. Defaults to on |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>100</code> | default height for the track |
| <span id="slot-y">**y**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <code>'score'</code> | the feature field plotted on the value axis, as a mark's encoding.y names one: a name, a dotted path or a `jexl:` expression. The default `score` is the field every adapter serves, including the value a BED adapter's `scoreColumn` rewrote it to; an explicit name reaches a raw column the adapter left alone (a BED extra column, a GFF attribute). A feature with no finite value in the field plots at 0 |
| <span id="slot-resolution">**resolution**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | how many points per pixel the fetch asks a tiered file for: 1 is one per pixel, larger is finer and smaller is coarser. Clamped to the range the Resolution menu offers, so a value outside it reads as the nearest end |
| <span id="slot-origin">**origin**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | The value bars grow from, and the cut a threshold color scale with an empty domain uses. The same slot, with the same meaning, as the mark display's origin |
| <span id="slot-size">**size**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the mark's size in px, the display's constant for what the mark display spells encoding.size: a point's diameter, 2 while unset, or a line's width, 1 while unset |
| <span id="slot-maxgapmultiple">**maxGapMultiple**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | Interpolated line only: break the line where consecutive points sit further apart than this multiple of the track's own mean point spacing, instead of drawing one long chord across the hole. Scaled to the data rather than a fixed bp distance so it holds at every zoom. 0 keeps one connected line<br>_advanced_ |
| <span id="slot-aggregate">**aggregate**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (max, min, mean, whiskers) = <code>'whiskers'</code> | which of a zoom bin's stored summaries is drawn: max, min, mean, or whiskers, which draws all three. A BigWig's zoom levels, and the bins JBrowse makes over its raw section, store all three; where the source serves raw values they are one number and the setting changes nothing |
| <span id="slot-showtree">**showTree**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Show the subtrack clustering tree in the sidebar |
| <span id="slot-showbranchlength">**showBranchLength**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | position tree nodes by branch length (dendrogram) rather than evenly by topology (cladogram) |
| <span id="slot-showrowlabels">**showRowLabels**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Name each subtrack row down the left edge |
| <span id="slot-treeareawidth">**treeAreaWidth**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>80</code> | width in px of the tree sidebar, which a drag on its edge also writes |
| <span id="slot-showrowseparators">**showRowSeparators**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | draw a hairline between adjacent rows; off by default, because a painting whose neighbouring rows differ in color already separates itself and the line only earns its pixel where they do not — a run of same-colored rows reads as one block without it, with no way to recover the row count by eye. Drawn only once rows are at least 4px tall: below that the line is as thick as the row it borders, turning a dense painting into a grid of hairlines with a little color between them |
