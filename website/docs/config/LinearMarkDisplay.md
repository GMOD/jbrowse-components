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
          shape: 'bar',
          encoding: { y: 'score', color: { field: 'strand', scale: 'categorical' } },
          maxBpPerPx: 100,
        },
        {
          shape: 'bar',
          transform: [
            { type: 'bin', step: 10000 },
            { type: 'aggregate', groupby: ['start', 'end'], ops: [{ op: 'count' }] },
          ],
          encoding: { y: 'count' },
          minBpPerPx: 100,
        },
      ],
    },
  ],
}
```

_See the **Config slots** section below for all available configuration fields._

A display whose picture is declared in config: a list of marks — bars, points
or spans — each with an encoding naming which feature fields feed its
channels. One fetch per region evaluates every encoding in the worker; the
marks draw in order over one score axis.

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
| <span id="slot-marksencodingcolorvalue">**marks.encoding.color.value**</span><br>[`color`](/docs/config_guides/slot_types#color) = <code>'#0068d1'</code> | A CSS colour, or a jexl callback over `feature` returning one, for a mark whose colour is not a scale. Writing `color: 'red'` or `color: 'jexl:…'` directly on the encoding lands here.<br>_callback args:_ `feature` |
| <span id="slot-marksencodingcolorfield">**marks.encoding.color.field**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | The feature field a scale reads — or a jexl callback over `feature`, which is slower per feature and so the opt-in. |
| <span id="slot-marksencodingcolorscale">**marks.encoding.color.scale**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (none, categorical, linear, log) = <code>'none'</code> | How `field` becomes a colour. `categorical` hands out palette entries per distinct value; `linear` and `log` read the value through `domain` into `ramp`. `none` paints `value`. |
| <span id="slot-marksencodingcolorpalette">**marks.encoding.color.palette**</span><br>`stringArray` = <code>[]</code> | The CSS colours a categorical scale hands out, in order. Empty uses the built-in qualitative palette. |
| <span id="slot-marksencodingcolordomain">**marks.encoding.color.domain**</span><br>`stringArray` = <code>[]</code> | For a categorical scale, the values in legend order, walking the palette from the first entry; left empty, each value derives its colour from itself, so every region agrees. For a linear or log scale, the `[min, max]` the ramp spans; empty uses each region's own extremes. |
| <span id="slot-marksencodingcolorramp">**marks.encoding.color.ramp**</span><br>`stringArray` = <code>[]</code> | A linear or log scale's ramp: `["viridis"]`, or two or more CSS colour stops spaced evenly. Empty is viridis. |
| <span id="slot-marksencodingglyphvalue">**marks.encoding.glyph.value**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'disc'</code> | `disc`, `triangle` or `diamond`, or a jexl callback over `feature` returning one, for a point mark whose glyph is not a scale. Writing `glyph: 'triangle'` directly on the encoding lands here.<br>_callback args:_ `feature` |
| <span id="slot-marksencodingglyphfield">**marks.encoding.glyph.field**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | The feature field a categorical scale reads — or a jexl callback over `feature`, which is slower per feature and so the opt-in. |
| <span id="slot-marksencodingglyphscale">**marks.encoding.glyph.scale**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (none, categorical) = <code>'none'</code> | `categorical` hands a glyph from `range` to each distinct value of `field`; `none` draws `value`. |
| <span id="slot-marksencodingglyphrange">**marks.encoding.glyph.range**</span><br>`stringArray` = <code>[]</code> | The glyph names a categorical scale hands out, in order. Empty is `disc`, `triangle`, `diamond`. |
| <span id="slot-marksencodingglyphdomain">**marks.encoding.glyph.domain**</span><br>`stringArray` = <code>[]</code> | The values in legend order, walking `range` from the first entry; left empty, each value derives its glyph from itself, so every region agrees. |
| <span id="slot-marksencodingyfield">**marks.encoding.y.field**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | The feature field, or jexl callback over `feature`, plotted on the score axis. A feature whose value is not a finite number is skipped. Empty for a mark with no value, which is what a span is. Writing `y: 'score'` directly on the encoding lands here. |
| <span id="slot-marksencodingyscale">**marks.encoding.y.scale**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (linear, log) = <code>'linear'</code> | How the axis reads the domain. This is the display's value scale: the ticks, the cross-hatches and the shader's placement all come from it, and the first mark that names a `field` is the one that owns it. |
| <span id="slot-marksencodingydomain">**marks.encoding.y.domain**</span><br>`stringArray` = <code>[]</code> | The `[min, max]` the axis spans, pinning what would otherwise autoscale to the loaded regions. An empty entry autoscales that end, so `["0", ""]` pins the floor alone. The score menu's "Set min/max" writes here. |
| <span id="slot-marksencodingyresolve">**marks.encoding.y.resolve**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (shared, independent) = <code>'shared'</code> | Which axis this mark reads. `shared` folds it into the display's one y domain with every other mark. `independent` gives it a domain folded from its own layers and a second axis on the right, so a coverage run and the raw features can share a plot. One mark per display may ask for it. |
| <span id="slot-marksencodingx">**marks.encoding.x**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'start'</code> | The feature field, or jexl callback over `feature`, giving the mark's left edge in bp. |
| <span id="slot-marksencodingx2">**marks.encoding.x2**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'end'</code> | The feature field, or jexl callback, giving the mark's right edge in bp. |
| <span id="slot-marksencodingy">**marks.encoding.y**</span><br><code>markValueSchema</code> | The value plotted on the score axis: a feature field, a jexl callback, or an object naming the field with the scale it is read through. The scale is the display's — its axis and its shader read the same declaration. |
| <span id="slot-marksencodingrow">**marks.encoding.row**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | For a span mark: the feature field, or jexl callback, naming the band the span stacks on, an integer from 0; a feature with nothing there sits on band 0. Empty puts every span on one band across the whole plot. |
| <span id="slot-marksencodingcolor">**marks.encoding.color**</span><br><code>markColorSchema</code> | The mark's colour: a CSS colour, a jexl callback returning one, or an object binding a field to a categorical or continuous scale. A scale is what the legend describes. |
| <span id="slot-marksencodingglyph">**marks.encoding.glyph**</span><br><code>markGlyphSchema</code> | For a point mark: `disc`, `triangle` or `diamond`, a jexl callback over `feature` returning one, or an object binding a field to a categorical scale over those names. A scale is what the legend describes. |
| <span id="slot-markstransformopsop">**marks.transform.ops.op**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (count, sum, mean, min, max) = <code>'count'</code> | `count` needs no field; `sum`, `mean`, `min` and `max` read one. |
| <span id="slot-markstransformopsfield">**marks.transform.ops.field**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | The feature field the op reads, for every op but `count`. |
| <span id="slot-markstransformopsas">**marks.transform.ops.as**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | The output field. Empty is `count`, or `<op>_<field>`. |
| <span id="slot-markstransformtype">**marks.transform.type**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (filter, formula, bin, aggregate, coverage, flatten, stack) = <code>'filter'</code> | `filter` keeps the features `expr` admits; `formula` writes `expr`'s value into `as`; `bin` snaps each feature to the `step`-bp bin its `field` falls in, writing the bin's edges over `start` and `end` (or the two names in `as`); `aggregate` folds each `groupby` group into one feature carrying `ops`; `coverage` replaces the features with runs of how many overlap each stretch, in `as` (`coverage`); `flatten` fans out an array field; `stack` writes each feature's row in a greedy first-fit packing, which a `span` reading `row` draws as a pileup. |
| <span id="slot-markstransformexpr">**marks.transform.expr**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | A jexl callback over `feature`, for a `filter` or `formula` step.<br>_callback args:_ `feature` |
| <span id="slot-markstransformfield">**marks.transform.field**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | For a `bin` step, the field placing a feature in a bin, `start` when empty; for a `flatten` step, the array field fanned out, `subfeatures` when empty. |
| <span id="slot-markstransformstep">**marks.transform.step**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>10000</code> | For a `bin` step: the bin width in bp, aligned to the genome, or `"auto"` for a width that follows the view's zoom — the target of four pixels per bin, snapped up to the next 1/2/5 rung, resolved before the fetch and keyed into it. |
| <span id="slot-markstransformas">**marks.transform.as**</span><br>`stringArray` = <code>[]</code> | The field a `formula`, `coverage` or `stack` step writes, the two fields a `bin` step writes its edges to, or the field a `flatten` step writes each element's index to. A single name may be written as a string. A `stack` leaving it empty writes `row`. |
| <span id="slot-markstransformfields">**marks.transform.fields**</span><br>`stringArray` = <code>[]</code> | For a `stack` step: the two fields giving the interval it packs, `start` and `end` when empty. |
| <span id="slot-markstransformpadding">**marks.transform.padding**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | For a `stack` step: bp of clearance kept between two features sharing a row, so a pileup does not butt its reads together. |
| <span id="slot-markstransformgroupby">**marks.transform.groupby**</span><br>`stringArray` = <code>[]</code> | For an `aggregate` step: the fields whose distinct value sets make the groups — `["start", "end"]` after a `bin`. Empty folds the whole region into one feature. For a `stack` step: the groups packed on their own rows, each numbered from 0. |
| <span id="slot-markstransformops">**marks.transform.ops**</span><br><code>types.array(aggregateOpSchema)</code> | For an `aggregate` step: the summaries each group carries. |
| <span id="slot-marksshape">**marks.shape**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (bar, point, span) = <code>'bar'</code> | `bar` stands between `origin` and `y`; `point` is a glyph at `y`; `span` is a band across the whole plot from `x` to `x2`. |
| <span id="slot-marksencoding">**marks.encoding**</span><br><code>markEncodingSchema</code> | Which feature fields feed the mark's channels. Every channel has a default, so `{}` draws a bar from `start` to `end` with no value. |
| <span id="slot-markstransform">**marks.transform**</span><br><code>types.array(transformStepSchema)</code> | Steps over the region's features before this mark encodes them, in order, after the display's `jexlFilters`. A `bin` then an `aggregate` grouped by `start` and `end` is a density: `count` per bin, plotted as `y`. |
| <span id="slot-markssource">**marks.source**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (features, density) = <code>'features'</code> | Where this mark draws from once the byte gate refuses the features. `features` is off — the mark draws nothing past the budget. `density` draws the adapter's `densityAdapter` sidecar in the banner's place, one bar per sidecar bin over this mark's own y axis, and needs no transform: the sidecar has already binned. With no density mark the banner stands. |
| <span id="slot-marksminbpperpx">**marks.minBpPerPx**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | The mark draws only when the view is at least this zoomed out, in bp per px. 0 sets no bound. With `maxBpPerPx` on another mark, one config shows a density zoomed out and the features zoomed in. |
| <span id="slot-marksmaxbpperpx">**marks.maxBpPerPx**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | The mark draws only when the view is zoomed in past this, in bp per px. 0 sets no bound. |
| <span id="slot-marks">**marks**</span><br><code>types.array(markSchema)</code> | The marks to draw, in order — a later one paints over an earlier one. Each is a `shape` and an `encoding`. |
| <span id="slot-origin">**origin**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | The value bars grow from. The axis widens to include it whenever a bar mark is drawn. |
| <span id="slot-minwidthpx">**minWidthPx**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | Narrowest a bar or span is painted, in px, grown off its start edge.<br>_advanced_ |
| <span id="slot-scatterpointsize">**scatterPointSize**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>4</code> | Diameter in px of point marks. |
| <span id="slot-minimalticks">**minimalTicks**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Draw only the min/max y-axis ticks.<br>_advanced_ |
| <span id="slot-showlegend">**showLegend**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Draw the colour key for every mark whose colour is a scale. Defaults to on. |
| <span id="slot-jexlfilters">**jexlFilters**</span><br>`stringArray` = <code>[]</code> | Jexl filters every feature must pass before it is encoded, written without the `jexl:` prefix. |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>150</code> | default height for the track |
| <span id="slot-fetchsizelimit">**fetchSizeLimit**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1_000_000</code> | maximum data to attempt to download for a given track, used if adapter doesn't specify one<br>_advanced_ |
| <span id="slot-forceload">**forceLoad**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Declarative equivalent of the "Force load" button on the "too much data" banner: when true the display always renders, however large the region or dense the features. Off by default (the gate guards against huge downloads). Set it on a view no one can interact with — an embedded / notebook view, or a screenshot — where the region is known and you want it drawn without a click.<br>_advanced_ |
| <span id="slot-densitytier">**densityTier**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (auto, features, density) = <code>'auto'</code> | when to draw the features-per-bin density band in place of features: "auto" swaps to it where the region is too large to fetch, "features" never does and keeps the banner, "density" always does. Needs a density source on the adapter (its densityAdapter slot)<br>_advanced_ |
| <span id="slot-densitytierbpperpx">**densityTierBpPerPx**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | in "auto" mode, also draw the density band from this many bp per pixel outward, before the region is too large to fetch; 0 leaves the swap to the fetch-size gate alone<br>_advanced_ |
| <span id="slot-minscore">**minScore**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>Number.MIN_VALUE</code> | Fixed minimum score bound. The default (Number.MIN_VALUE) is a sentinel meaning "unset, use autoscale"<br>_advanced_ |
| <span id="slot-maxscore">**maxScore**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>Number.MAX_VALUE</code> | Fixed maximum score bound. The default (Number.MAX_VALUE) is a sentinel meaning "unset, use autoscale"<br>_advanced_ |
| <span id="slot-scaletype">**scaleType**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (linear, log) = <code>'linear'</code> | Scale type (linear or log) |
| <span id="slot-autoscale">**autoscale**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (local, localsd, localpercentile) = <code>'localpercentile'</code> | Autoscale type: "local" uses the min/max in the visible region, "localsd" uses mean ± numStdDev standard deviations, "localpercentile" uses the numQuantile-th percentile score as the max (robust to skewed/peaky data) |
| <span id="slot-numstddev">**numStdDev**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>3</code> | Number of standard deviations to use for the localsd autoscale type<br>_advanced_ |
| <span id="slot-displaycrosshatches">**displayCrossHatches**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Rule the score axis with horizontal cross hatches at the tick positions — the config form of the score menu's "Show cross hatches". Ignored by the density rendering types, which spend color rather than height on the score and so have no axis to rule |
