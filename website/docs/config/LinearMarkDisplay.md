---
id: linearmarkdisplay
title: LinearMarkDisplay
sidebar_label: Display -> LinearMarkDisplay
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `marks` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/marks/src/LinearMarkDisplay/configSchema.ts).

## Example usage

A BED score column as bars, coloured by strand, with the key on screen,
and a per-10 kb count in its place once the view is wider than 100 bp
per px:

```js
{
  type: 'FeatureTrack',
  trackId: 'scores',
  name: 'Scores',
  assemblyNames: ['hg38'],
  adapter: { type: 'BedTabixAdapter', uri: 'https://example.com/scores.bed.gz' },
  displays: [
    {
      type: 'LinearMarkDisplay',
      displayId: 'scores-LinearMarkDisplay',
      marks: [
        {
          mark: 'bar',
          encoding: { y: 'score', color: { field: 'strand', scale: 'categorical' } },
          maxBpPerPx: 100,
        },
        {
          mark: 'bar',
          transform: [
            { type: 'bin', step: 10000 },
            { type: 'aggregate', groupby: ['start', 'end'], ops: [{ op: 'count' }] },
          ],
          minBpPerPx: 100,
        },
      ],
    },
  ],
}
```

_See the **Config slots** section below for all available configuration fields._

A grammar of graphics over a feature, alignments or variant track: a list of
marks — bars, points, spans or text — each with an encoding naming which
feature fields feed its channels and a transform list run before it. One fetch per
region evaluates every encoding in the worker; the marks draw in order over
one score axis.

## Related links

- **Adapter:** [BedAdapter](../bedadapter)
- **Adapter:** [BedTabixAdapter](../bedtabixadapter)
- **Adapter:** [BigBedAdapter](../bigbedadapter)
- **Adapter:** [CrisprGuideAdapter](../crisprguideadapter)
- **Adapter:** [FromConfigAdapter](../fromconfigadapter)
- **Adapter:** [Gff3Adapter](../gff3adapter)
- **Adapter:** [Gff3TabixAdapter](../gff3tabixadapter)
- **Adapter:** [GtfAdapter](../gtfadapter)
- **Adapter:** [GtfTabixAdapter](../gtftabixadapter)
- **Adapter:** [NCListAdapter](../nclistadapter)
- **Adapter:** [SequenceSearchAdapter](../sequencesearchadapter)
- **Adapter:** [SPARQLAdapter](../sparqladapter)
- **State model:** [runtime API](../../models/linearmarkdisplay)

## Config slots

These slots go on a display entry: `"displays": [{ "type": "LinearMarkDisplay", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-marksencodingshapevalue">**marks.encoding.shape.value**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) = <code>'circle'</code> | `circle`, `triangle-down` or `diamond`, or a jexl callback over `feature` returning one, for a point mark whose shape is not a scale. Writing `shape: 'triangle-down'` directly on the encoding lands here.<br>_callback args:_ `feature` |
| <span id="slot-marksencodingshapefield">**marks.encoding.shape.field**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <code>''</code> | The feature field a categorical scale reads — or a jexl expression over `feature`, which is slower per feature and so the opt-in. |
| <span id="slot-marksencodingshapescale">**marks.encoding.shape.scale**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (none, categorical) | `categorical` hands a shape from `range` to each distinct value of `field`; `none` draws `value`. Unset beside a `field`, it is `categorical`. |
| <span id="slot-marksencodingshaperange">**marks.encoding.shape.range**</span><br>[`stringEnumArray`](/docs/config_guides/slot_types#stringenumarray) = <code>[]</code> | The shape names a categorical scale hands out, in order. Empty is `circle`, `triangle-down`, `diamond`. |
| <span id="slot-marksencodingshapedomain">**marks.encoding.shape.domain**</span><br>`stringArray` = <code>[]</code> | The values in legend order, walking `range` from the first entry; left empty, each value derives its shape from itself, so every region agrees. |
| <span id="slot-marksencodingx">**marks.encoding.x**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <code>'start'</code> | The feature field, or jexl expression over `feature`, giving the mark's left edge in bp. |
| <span id="slot-marksencodingx2">**marks.encoding.x2**</span><br>[MarkLocus](../marklocus) | The feature field, or jexl expression, giving the mark's right edge in bp, or for a link its far foot: an object naming the field holding the foot's sequence beside the one holding its position, where a mate may lie on another sequence. Left at `end` behind a `mate` step, it is the other end the step found. |
| <span id="slot-marksencodingy">**marks.encoding.y**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <code>''</code> | The feature field, or jexl expression over `feature`, plotted on the score axis. A feature whose value is not a finite number is skipped. Empty reads what the steps before this mark's encode wrote, the way a ggplot2 stat names what its geom plots: a `coverage` step's depth, or the one summary an `aggregate` with one op writes. A bar or point with neither draws nothing, and the track's corner notice says so, while a text with neither stands in the middle of its band. The scale it is read through is the display's `scales.y`. |
| <span id="slot-marksencodingrow">**marks.encoding.row**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <code>''</code> | The feature field, or jexl expression, naming the band the mark stands in, an integer from 0; a feature with nothing there sits on band 0. Empty reads the field the last `pileup` before this mark's encode wrote, this mark's own, the facet's or the display's, and puts every mark on one band across the whole plot where none packs. |
| <span id="slot-marksencodingcolor">**marks.encoding.color**</span><br>[MarkColor](../markcolor) | The mark's colour: a CSS colour, a jexl callback returning one, or an object binding a field to a categorical or continuous scale. A scale is what the legend describes. |
| <span id="slot-marksencodingshape">**marks.encoding.shape**</span><br><code>markShapeSchema</code> | For a point mark: `circle`, `triangle-down` or `diamond`, a jexl callback over `feature` returning one, or an object binding a field to a categorical scale over those names. A scale is what the legend describes. |
| <span id="slot-marksencodingtext">**marks.encoding.text**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <code>'name'</code> | For a text mark: the feature field, or jexl expression over `feature`, it prints, `name` unset. A feature with nothing there prints nothing. |
| <span id="slot-marksencodingsize">**marks.encoding.size**</span><br>[MarkSize](../marksize) | For a link mark: a feature field read through a linear or log scale into a stroke width in px, `range` the px at each end of the domain. Empty strokes every link at the mark's own `size`. |
| <span id="slot-marksmark">**marks.mark**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (bar, point, span, text, link) = <code>'bar'</code> | `bar` stands between `origin` and `y`; `point` is a shape at `y`; `span` is a band across the whole plot from `x` to `x2`; `text` prints a field over the middle of `x` to `x2`, just above `y` where it names one and in the middle of its band otherwise, and a label that would overlap one already placed to its left is left out; `link` is a curve from `x` up and over to `x2`, which may lie on another sequence, its apex at `y` where it names one. |
| <span id="slot-markssize">**marks.size**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>4</code> | A point mark's diameter or a link's stroke width in px, the mark's own as a grammar's `size` is, so two marks may differ; a bar, span or text reads none, and a link whose `encoding.size` names a field reads that instead. Unwritten, a link strokes at 2 px. The track menu's Point size writes it on every point mark. |
| <span id="slot-markslinkshape">**marks.linkShape**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (dome, arc, line) = <code>'dome'</code> | How a link mark draws: `dome`, a half-ellipse whose apex is the pair's half-width clamped to the band, `arc`, a true semicircle that may leave it, or `line`, a straight segment between the feet, on the baseline or at the `y` value. Past three block widths a dome or arc becomes a circle whose legs rise from each foot. |
| <span id="slot-marksencoding">**marks.encoding**</span><br><code>markEncodingSchema</code> | Which feature fields feed the mark's channels. Every channel has a default, so `{}` draws a bar from `start` to `end` with no value. |
| <span id="slot-markstransform">**marks.transform**</span><br>[MarkTransform](../marktransform) | Steps over the region's features before this mark encodes them, in order, after the display's own `transform`, and over each section alone under a facet. A `bin` then an `aggregate` grouped by `start` and `end` is a density: `count` per bin, which the mark plots as `y` unless its encoding names another field. |
| <span id="slot-markssource">**marks.source**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (features, density) = <code>'features'</code> | Where this mark draws from once the byte gate refuses the features. `features` is off — the mark draws nothing past the budget. `density` draws the adapter's `densityAdapter` sidecar in the banner's place, one bar per sidecar bin over this mark's own y axis, and needs no transform: the sidecar has already binned. With no density mark the banner stands. |
| <span id="slot-marksminbpperpx">**marks.minBpPerPx**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | The mark draws only when the view is at least this zoomed out, in bp per px. 0 sets no bound. With `maxBpPerPx` on another mark, one config shows a density zoomed out and the features zoomed in. |
| <span id="slot-marksmaxbpperpx">**marks.maxBpPerPx**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | The mark draws only when the view is zoomed in past this, in bp per px. 0 sets no bound. |
| <span id="slot-marks">**marks**</span><br><code>types.array(markSchema)</code> | The marks to draw, in order — a later one paints over an earlier one. Each is a `mark` and an `encoding`. |
| <span id="slot-transform">**transform**</span><br>[MarkTransform](../marktransform) | Steps over the region's features before the facet splits them and before any mark's own, after `jexlFilters`: where a field the facet reads is made, such as a formula lifting a read's tag. |
| <span id="slot-facet">**facet**</span><br>[MarkFacet](../markfacet) | Labelled sections, one per value of a field, each as tall as its steps pack it: `"HP"`, or `{ field, domain, transform }` with the order the sections stack in and the steps each runs before any mark's, a per-section `pileup` among them. A chip names each section and hides it, and past forty values the tail merges into one. Split after `transform` and before any mark's own steps. |
| <span id="slot-rows">**rows**</span><br>[Rows](../rows) | One row per value of a field, for bar and point marks: `"source"` over a multi-BigWig is one xyplot per file. The worker splits the features on the field as it does for `facet`, and the rows take the tree sidebar, the row labels, clustering and the arrangement dialog, whose order, labels, tree and focus this object holds. Beside a `facet`, the facet draws; on another field that asks for bands of rows, which are not drawn yet, and a notice says so.<br><span class="cell-more"><button type="button" class="cell-more-trigger">example</button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ rows: 'source' }</code></pre><pre><code>{ rows: { field: 'source', domain: ['tumor', 'normal'] } }</code></pre></dialog></span> |
| <span id="slot-rowcolor">**rowColor**</span><br>[RowColor](../rowcolor) | The tint beside each row's label, the marks keeping their own colour: under the default field `name`, a row's value paired with a colour in `domain`/`range`, which the arrangement dialog writes. |
| <span id="slot-scales">**scales**</span><br>[ValueScale](../valuescale) | The scales the marks are read through, owned by the display rather than by a mark: `y` alone, and every mark's `encoding.y` shares it. The same object the wiggle family declares, with its three scale types and with the guides the scale owns: `rules`, its reference lines, and `title`, the caption beside its axis. |
| <span id="slot-origin">**origin**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | The value bars grow from. The axis widens to include it whenever a bar mark is drawn. |
| <span id="slot-minwidthpx">**minWidthPx**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | Narrowest a bar or span is painted, in px, grown off its start edge.<br>_advanced_ |
| <span id="slot-minimalticks">**minimalTicks**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Draw only the min/max y-axis ticks.<br>_advanced_ |
| <span id="slot-displaycrosshatches">**displayCrossHatches**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Rule the plot with horizontal cross hatches at the tick positions — the config form of the score menu's "Show cross hatches". |
| <span id="slot-showlegend">**showLegend**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Draw the colour key for every mark whose colour is a scale. Defaults to on. |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>150</code> | default height for the track |
| <span id="slot-fetchsizelimit">**fetchSizeLimit**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1_000_000</code> | maximum data to attempt to download for a given track, used if adapter doesn't specify one<br>_advanced_ |
| <span id="slot-forceload">**forceLoad**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Declarative equivalent of the "Force load" button on the "too much data" banner: when true the display always renders, however large the region or dense the features. Off by default (the gate guards against huge downloads). Set it on a view no one can interact with — an embedded / notebook view, or a screenshot — where the region is known and you want it drawn without a click.<br>_advanced_ |
| <span id="slot-densitytier">**densityTier**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (auto, features, density) = <code>'auto'</code> | when to draw the features-per-bin density band in place of features: "auto" swaps to it where the region is too large to fetch, "features" never does and keeps the banner, "density" always does. Needs a density source on the adapter (its densityAdapter slot)<br>_advanced_ |
| <span id="slot-densitytierbpperpx">**densityTierBpPerPx**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | in "auto" mode, also draw the density band from this many bp per pixel outward, before the region is too large to fetch; 0 leaves the swap to the fetch-size gate alone<br>_advanced_ |
| <span id="slot-showtree">**showTree**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | show the cluster tree beside the rows |
| <span id="slot-showbranchlength">**showBranchLength**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | position tree nodes by branch length (dendrogram) rather than evenly by topology (cladogram) |
| <span id="slot-showrowlabels">**showRowLabels**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | draw the row value over the left of each row |
| <span id="slot-treeareawidth">**treeAreaWidth**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>80</code> | width in px of the tree sidebar, which a drag on its edge also writes |
| <span id="slot-jexlfilters">**jexlFilters**</span><br>`stringArray` = <code>[]</code> | default set of jexl filters to apply to a track. note: these do not use the jexl prefix because they have a deferred evaluation system |
