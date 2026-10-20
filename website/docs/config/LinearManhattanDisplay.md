---
id: linearmanhattandisplay
title: LinearManhattanDisplay
description: "The Manhattan plot: the default display of a GWAS track, and one a FeatureTrack can switch to."
sidebar_label: Display -> LinearManhattanDisplay
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `gwas` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gwas/src/LinearManhattanDisplay/configSchemaFactory.ts).

The Manhattan plot: the default display of a GWAS track, and one a
FeatureTrack can switch to. It is the mark display with a point per feature
at its `score` as its default plot, so every mark, scale, facet and row
setting applies, and a plot whose encoding names `r2` or `ld_role` joins
each SNP's r² to the index SNP from the `GWASAdapter`'s `ldAdapter`.

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

LocusZoom-style coloring in two marks: every other point by its r² to
the index SNP in five bins, then the index alone as a pink diamond over
them, the key listing the bins highest first and the index in a separate row.
The LD data is a second source on `GWASAdapter`, so it nests under
`adapter`, while the plot goes in `displayDefaults`. The track menu's
"Color by LD to index SNP" makes the same pair of each point mark of a
plot, and leaves the rest of the plot as it was:

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
    marks: [
      {
        mark: 'point',
        transform: [
          { type: 'filter', expr: "jexl:feature.ld_role != 'index'" },
        ],
        encoding: {
          y: 'score',
          color: {
            field: 'r2',
            scale: 'threshold',
            domain: [0.2, 0.4, 0.6, 0.8],
            range: ['#357ebd', '#46b8da', '#5cb85c', '#eea236', '#d43f3a'],
            title: 'r² to index SNP',
            descending: true,
            missingLabel: 'No LD data',
          },
        },
      },
      {
        mark: 'point',
        transform: [
          { type: 'filter', expr: "jexl:feature.ld_role == 'index'" },
        ],
        encoding: {
          y: 'score',
          color: { value: '#c951c9' },
          shape: {
            field: 'ld_role',
            domain: ['index'],
            range: ['diamond'],
            labels: ['Index SNP'],
            title: '',
          },
        },
      },
    ],
  },
}
```

A selection scan as a plain `FeatureTrack`: a point per window at its
`fst` column, colored by its `population` column:

```js
{
  type: 'FeatureTrack',
  trackId: 'fst_scan',
  name: 'Fst scan',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BedTabixAdapter',
    uri: 'https://example.com/fst.bed.gz',
  },
  displays: [
    {
      type: 'LinearManhattanDisplay',
      marks: [
        {
          mark: 'point',
          encoding: { y: 'fst', color: { field: 'population' } },
        },
      ],
    },
  ],
}
```

## Related links

- **Adapter:** [GWASAdapter](../gwasadapter)
- **State model:** [runtime API](../../models/linearmanhattandisplay)
- **Base config:** [LinearMarkDisplay](../linearmarkdisplay)

## Config slots

Display slots go on a display entry: `"displays": [{ "type": "LinearManhattanDisplay", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-marks">**marks**</span><br><code>markListSchema([MANHATTAN_MARK])</code> | The plot, as `LinearMarkDisplay` reads it: unwritten, a point per feature at its `score`. |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>100</code> | default height for the track |
| <span class="slot-group">Inherited from [LinearMarkDisplay](../linearmarkdisplay)</span> | <span class="slot-group-count">42 slots</span> |
| <span id="slot-marksencodingshapevalue">**marks.encoding.shape.value**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) = <code>'circle'</code> | `circle`, `triangle-down` or `diamond`, or a jexl callback over `feature` returning one, for a point mark whose shape is not a scale.<br>_callback args:_ `feature` |
| <span id="slot-marksencodingshapefield">**marks.encoding.shape.field**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <code>''</code> | The feature field a categorical scale reads — or a jexl expression over `feature`, which is slower per feature and so the opt-in. |
| <span id="slot-marksencodingshapescale">**marks.encoding.shape.scale**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (none, categorical) | `categorical` hands a shape from `range` to each distinct value of `field`; `none` draws `value`. Unset beside a `field`, it is `categorical`. |
| <span id="slot-marksencodingshaperange">**marks.encoding.shape.range**</span><br>[`stringEnumArray`](/docs/config_guides/slot_types#stringenumarray) = <code>[]</code> | The shape names a categorical scale hands out, in order. Empty is `circle`, `triangle-down`, `diamond`. |
| <span id="slot-marksencodingshapedomain">**marks.encoding.shape.domain**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | The values in legend order, walking `range` from the first entry; left empty, each value derives its shape from itself, so every region agrees. |
| <span id="slot-marksencodingshapetitle">**marks.encoding.shape.title**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | The heading of the key a categorical scale draws, naming what the shape marks. Unset, the key is titled with `field`; `""` is a key with no title. |
| <span id="slot-marksencodingshapelabels">**marks.encoding.shape.labels**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | The key's name for each `domain` value, one each in order; a value past the end of the list shows its name. |
| <span id="slot-marksencodingshapebreaks">**marks.encoding.shape.breaks**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | The values the key lists, in this order; empty lists every value the loaded regions met. A value left out still takes its shape. |
| <span id="slot-marksencodingshapemissinglabel">**marks.encoding.shape.missingLabel**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | The key's name for a feature with nothing in `field`; unset is "(no value)". |
| <span id="slot-marksencodingx">**marks.encoding.x**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <code>'start'</code> | The feature field, or jexl expression over `feature`, giving the mark's left edge in bp. |
| <span id="slot-marksencodingx2">**marks.encoding.x2**</span><br>[MarkLocus](../marklocus) | The feature field, or jexl expression, giving the mark's right edge in bp, or for a link its far foot: an object naming the field holding the foot's sequence beside the one holding its position, where a mate may lie on another sequence. Left at `end` behind a `mate` step, it is the other end the step found. |
| <span id="slot-marksencodingy">**marks.encoding.y**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <code>''</code> | The feature field, or jexl expression over `feature`, plotted on the score axis. A feature whose value is not a finite number is skipped. Empty reads what the steps before this mark's encode wrote, the way a ggplot2 stat names what its geom plots: a `coverage` step's depth, or the one summary an `aggregate` with one op writes. A bar or point with neither draws nothing and the track shows a corner notice, while a text with neither stands at the apex of a link drawn between its two ends, or in the middle of its band where none is. The scale it is read through is the display's `scales.y`. |
| <span id="slot-marksencodingrow">**marks.encoding.row**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <code>''</code> | The feature field, or jexl expression, naming the band the mark stands in, an integer from 0; a feature with nothing there sits on band 0. Empty reads the field the last `pileup` before this mark's encode wrote, this mark's own, the facet's or the display's, and puts every mark on one band across the whole plot where none packs. |
| <span id="slot-marksencodingcolor">**marks.encoding.color**</span><br>[MarkColor](../markcolor) | The mark's color: a field through a categorical or continuous scale, written bare or as an object with the scale's members, or a constant `{ value }`, a CSS color or a jexl callback returning one. A scale is what the legend describes. |
| <span id="slot-marksencodingshape">**marks.encoding.shape**</span><br><code>markShapeSchema</code> | For a point mark: a field through a categorical scale over `circle`, `triangle-down` and `diamond`, written bare or as an object, or a constant `{ value }`, one of those names or a jexl callback returning one. A scale is what the legend describes. |
| <span id="slot-marksencodingtext">**marks.encoding.text**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <code>'name'</code> | For a text mark: the feature field, or jexl expression over `feature`, it prints, `name` unset. A feature with nothing there prints nothing. |
| <span id="slot-marksencodingsize">**marks.encoding.size**</span><br>[MarkSize](../marksize) | The mark's size in px: a number is a point's diameter, a rule's thickness, a line's width or a link's stroke; a field, which a link alone reads, goes through a linear or log scale into a stroke width, `range` the px at each end of the domain. The track menu's Point size writes every point mark's number. |
| <span id="slot-marksmark">**marks.mark**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (bar, point, rule, line, span, text, link) = <code>'bar'</code> | `bar` spans from `origin` to `y`; `point` is a shape at `y` over the middle of `x` to `x2`; `rule` is a line across `x` to `x2` at `y`, `encoding.size` px thick; `line` is a stroke through consecutive values, held across each span or run centre to centre as `interpolate` says, dropping to `origin` across a gap; `span` is a band across the whole plot from `x` to `x2`; `text` prints a field over the middle of `x` to `x2`, just above `y` where it names one, at the apex of a link drawn between the same two ends, and in the middle of its band otherwise, and the display omits a label that would overlap one already placed to its left; `link` is a curve from `x` up and over to `x2`, which may lie on another sequence, its apex at `y` where it names one. |
| <span id="slot-marksinterpolate">**marks.interpolate**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (step, linear) = <code>'step'</code> | The path a `line` takes between values: `step` holds each across its span, as the data says; `linear` runs from one span's centre to the next, smoother where the spans are few. Read by a line alone. |
| <span id="slot-marksgapbp">**marks.gapBp**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | The stretch in bp a `linear` line breaks across rather than bridge: where the next value's middle lies further on than this. Unset, a `window` step in front sets it to the bases its frame spans at the median row, so a moving average breaks where no data reached, and with none the line runs unbroken. Read by a line alone. |
| <span id="slot-markslinkshape">**marks.linkShape**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (dome, arc, line) = <code>'dome'</code> | The shape of a link mark: `dome` is a half-ellipse whose apex is the pair's half-width clamped to the band, `arc` a true semicircle that may leave it, and `line` a straight segment between the feet, on the baseline or at the `y` value. A dome or arc wider than three view widths becomes a circle whose legs rise from each foot. |
| <span id="slot-marksrowproportion">**marks.rowProportion**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | The fraction of its row's height a span fills, centred in the row, so below 1 the rows stand apart. Read by a span alone; the track menu's Row height presets write every span's. |
| <span id="slot-marksencoding">**marks.encoding**</span><br><code>markEncodingSchema</code> | The feature field each of the mark's channels reads. Every channel has a default, so `{}` draws a bar from `start` to `end` with no value. |
| <span id="slot-markstransform">**marks.transform**</span><br>[MarkTransform](../marktransform) | Steps over the region's features before this mark encodes them, in order, after the display's own `transform`, and over each section alone under a facet. A `bin` then an `aggregate` grouped by `start` and `end` is a density: `count` per bin, which the mark plots as `y` unless its encoding names another field. |
| <span id="slot-marksminbpperpx">**marks.minBpPerPx**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | The mark draws only when the view is at least this zoomed out, in bp per px. 0 sets no bound. With `maxBpPerPx` on another mark, one config shows a density zoomed out and the features zoomed in. |
| <span id="slot-marksmaxbpperpx">**marks.maxBpPerPx**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | The mark draws only when the view is zoomed in past this, in bp per px. 0 sets no bound. |
| <span id="slot-transform">**transform**</span><br>[MarkTransform](../marktransform) | Steps over the region's features before the facet splits them and before any mark's own, after `filter`: where a field the facet reads is made, such as a formula lifting a read's tag. |
| <span id="slot-facet">**facet**</span><br>[MarkFacet](../markfacet) | Labelled sections, one per value of a field, each as tall as its steps pack it: `"HP"`, or `{ field, domain, transform }` with the order the sections stack in and the steps each runs before any mark's, a per-section `pileup` among them. A chip names each section and hides it. Split after `transform` and before any mark's own steps. |
| <span id="slot-rows">**rows**</span><br>[Rows](../rows) | One row per value of a field: `"source"` over a multi-BigWig is one xyplot per file. The worker splits the features on the field as it does for `facet`, and the rows take the tree sidebar, the row labels, clustering and the arrangement dialog, whose order, labels, tree and focus this object holds. Beside a `facet`, the facet draws; on another field that asks for bands of rows, which are not drawn yet, the display shows a notice.<br><span class="cell-more"><button type="button" class="cell-more-trigger">example</button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ rows: 'source' }</code></pre><pre><code>{ rows: { field: 'source', domain: ['tumor', 'normal'] } }</code></pre></dialog></span> |
| <span id="slot-rowcolor">**rowColor**</span><br>[RowColor](../rowcolor) | The bar beside each row's label; the marks keep their color. Under the default field `name`, a row's value paired with a color in `domain`/`range`, which the arrangement dialog writes. |
| <span id="slot-scales">**scales**</span><br>[ValueScale](../valuescale) | The scales the marks are read through, owned by the display rather than by a mark: `y` alone, and every mark's `encoding.y` shares it. The same object the wiggle family declares. |
| <span id="slot-origin">**origin**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | The value bars grow from. The axis widens to include it whenever a bar mark is drawn. |
| <span id="slot-minwidthpx">**minWidthPx**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | Narrowest a bar or span is painted, in px, grown off its start edge.<br>_advanced_ |
| <span id="slot-showlegend">**showLegend**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Draw the color key for every mark whose color is a scale. Defaults to on. |
| <span id="slot-filter">**filter**</span><br>[FeatureFilter](../featurefilter) | The features the display draws: `expressions`, a list of `jexl:` tests. |
| <span id="slot-fetchsizelimit">**fetchSizeLimit**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1000000</code> | bytes a region may fetch before the display asks first; an adapter that sets its own limit overrides this<br>_advanced_ |
| <span id="slot-forceload">**forceLoad**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Declarative equivalent of the "Force load" button on the "too much data" banner: when true the display always renders, however large the region or dense the features. Off by default (the gate guards against huge downloads). Set it on a view no one can interact with — an embedded / notebook view, or a screenshot — where the region is known and you want it drawn without a click.<br>_advanced_ |
| <span id="slot-showtree">**showTree**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | show the cluster tree beside the rows |
| <span id="slot-showbranchlength">**showBranchLength**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | position tree nodes by branch length (dendrogram) rather than evenly by topology (cladogram) |
| <span id="slot-showrowlabels">**showRowLabels**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | draw the row value over the left of each row |
| <span id="slot-treeareawidth">**treeAreaWidth**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>80</code> | width in px of the tree sidebar, which a drag on its edge also writes |
| <span id="slot-rowheight">**rowHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | per-row height in px under rows, scrolling the rows that do not fit; 0 (the default) fits the rows to the plot instead, dividing it between them |

## Retired keys

An older config may still write these. Each loads without an error, and `jbrowse validate` reports it as stale.

<!-- prettier-ignore -->
| Key | On load |
| --- | --- |
| `maxFeatureScreenDensity` | ignored |
| `maxDisplayedBpPerPx` | ignored |
| `mouseover` | ignored |
| `jexlFilters` | moved into a current slot |
