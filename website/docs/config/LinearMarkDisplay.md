---
id: linearmarkdisplay
title: LinearMarkDisplay
sidebar_label: Display -> LinearMarkDisplay
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `marks` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/marks/src/LinearMarkDisplay/configSchema.ts).

## Example usage

A BED score column as bars, coloured by strand, with the key on screen:

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
| <span id="slot-marksencodingx">**marks.encoding.x**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'start'</code> | The feature field, or jexl callback over `feature`, giving the mark's left edge in bp. |
| <span id="slot-marksencodingx2">**marks.encoding.x2**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'end'</code> | The feature field, or jexl callback, giving the mark's right edge in bp. |
| <span id="slot-marksencodingy">**marks.encoding.y**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | The feature field, or jexl callback, plotted on the score axis. A feature whose value is not a finite number is skipped. Empty for a mark with no value, which is what a span is. |
| <span id="slot-marksencodingcolor">**marks.encoding.color**</span><br><code>markColorSchema</code> | The mark's colour: a CSS colour, a jexl callback returning one, or an object binding a field to a categorical or continuous scale. A scale is what the legend describes. |
| <span id="slot-marksencodingglyph">**marks.encoding.glyph**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'disc'</code> | For a point mark: `disc`, `triangle` or `diamond`, or a jexl callback over `feature` returning one of those. |
| <span id="slot-marksshape">**marks.shape**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (bar, point, span) = <code>'bar'</code> | `bar` stands between `origin` and `y`; `point` is a glyph at `y`; `span` is a band across the whole plot from `x` to `x2`. |
| <span id="slot-marksencoding">**marks.encoding**</span><br><code>markEncodingSchema</code> | Which feature fields feed the mark's channels. Every channel has a default, so `{}` draws a bar from `start` to `end` with no value. |
| <span id="slot-marks">**marks**</span><br><code>types.array(markSchema)</code> | The marks to draw, in order — a later one paints over an earlier one. Each is a `shape` and an `encoding`. |
| <span id="slot-origin">**origin**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | The value bars grow from. The axis widens to include it whenever a bar mark is drawn. |
| <span id="slot-minwidthpx">**minWidthPx**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | Narrowest a bar or span is painted, in px, grown off its start edge.<br>_advanced_ |
| <span id="slot-scatterpointsize">**scatterPointSize**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) = <code>4</code> _promotable_ | Diameter in px of point marks. Unset (the default) follows the session-wide default for this display type. |
| <span id="slot-minimalticks">**minimalTicks**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Draw only the min/max y-axis ticks.<br>_advanced_ |
| <span id="slot-showlegend">**showLegend**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) = <code>true</code> _promotable_ | Draw the colour key for every mark whose colour is a scale. Unset (the default) follows the session-wide default for this display type, falling back to on. |
| <span id="slot-jexlfilters">**jexlFilters**</span><br>`stringArray` = <code>[]</code> | Jexl filters every feature must pass before it is encoded, written without the `jexl:` prefix. |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>150</code> | default height for the track |
| <span id="slot-minscore">**minScore**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>Number.MIN_VALUE</code> | Fixed minimum score bound. The default (Number.MIN_VALUE) is a sentinel meaning "unset, use autoscale"<br>_advanced_ |
| <span id="slot-maxscore">**maxScore**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>Number.MAX_VALUE</code> | Fixed maximum score bound. The default (Number.MAX_VALUE) is a sentinel meaning "unset, use autoscale"<br>_advanced_ |
| <span id="slot-scaletype">**scaleType**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (linear, log) = <code>'linear'</code> | Scale type (linear or log) |
| <span id="slot-autoscale">**autoscale**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (local, localsd, localpercentile) = <code>'localpercentile'</code> | Autoscale type: "local" uses the min/max in the visible region, "localsd" uses mean ± numStdDev standard deviations, "localpercentile" uses the numQuantile-th percentile score as the max (robust to skewed/peaky data) |
| <span id="slot-numstddev">**numStdDev**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>3</code> | Number of standard deviations to use for the localsd autoscale type<br>_advanced_ |
| <span id="slot-displaycrosshatches">**displayCrossHatches**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Rule the score axis with horizontal cross hatches at the tick positions — the config form of the score menu's "Show cross hatches". Ignored by the density rendering types, which spend color rather than height on the score and so have no axis to rule |
