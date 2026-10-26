---
id: linearwiggledisplay
title: LinearWiggleDisplay
description: "Draws quantitative signal as bars, points, a line or a color strip (rect), for one source or many; rows: 'source' draws each source in a separate row."
sidebar_label: Display -> LinearWiggleDisplay
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `wiggle` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/LinearWiggleDisplay/configSchema.ts).

Draws quantitative signal as bars, points, a line or a color strip (`rect`),
for one source or many; `rows: 'source'` draws each source in a separate row.

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
    encoding: {
      y: { scale: { type: 'log' } },
      color: { value: 'darkgreen' },
    },
  },
}
```

## Related links

- **Adapter:** [BedGraphAdapter](../bedgraphadapter)
- **Adapter:** [BedGraphTabixAdapter](../bedgraphtabixadapter)
- **Adapter:** [BigWigAdapter](../bigwigadapter)
- **State model:** [runtime API](../../models/linearwiggledisplay)

## Config slots

Display slots go on a display entry: `"displays": [{ "type": "LinearWiggleDisplay", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-mark">**mark**</span><br>[WiggleMark](../wigglemark) | The shape each score is drawn as, using the mark display's names: `bar` draws a bar from the `origin` to the score, `point` a point at it, `line` a line through the scores, stepped or as `interpolate` says, and `rect` a strip whose color is the score. The track menu's Plot type writes it. v4's `defaultRendering` loads as its `mark`: `xyplot` a bar, `scatter` a point, `density` a rect, `line` a stepped line and `linecenter` a linear one. A [](/docs/config/wigglemark) object, or its `type` alone.<br><span class="cell-more"><button type="button" class="cell-more-trigger">example</button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{&#10;&#160;&#160;"type": "LinearWiggleDisplay",&#10;&#160;&#160;"mark": "rect"&#10;}</code></pre></dialog></span> |
| <span id="slot-rows">**rows**</span><br>[QuantitativeRows](../quantitativerows) | One row per value of a field, stacked down the track with a label, a separator and the clustering sidebar, and the arrangement a reader gives them. `source` — one row per subtrack — is the only field this display reads; leave it unset and every source is drawn in one shared plot. `sort` is the row order: the subtracks it names lead, the rest keep the adapter's order, and a clustering run rotates its dendrogram towards it rather than discarding it. `labels`, `tree`, `treeProvenance` and `kept` are what the arrangement dialog, a clustering run and a focus write, each as a session edit to this object.<br><span class="cell-more"><button type="button" class="cell-more-trigger">example</button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{&#10;&#160;&#160;"type": "LinearWiggleDisplay",&#10;&#160;&#160;"rows": "source"&#10;}</code></pre></dialog></span> |
| <span id="slot-rowcolor">**rowColor**</span><br>[RowColor](../rowcolor) | The color a reader set on a named subtrack, as `scale.domain` and `scale.range` pairs, ahead of the adapter's color and the palette: its plot while `encoding.color` is unset, and otherwise, or under a score gradient, the tint beside its label.<br><span class="cell-more"><button type="button" class="cell-more-trigger">example</button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{&#10;&#160;&#160;"type": "LinearWiggleDisplay",&#10;&#160;&#160;"rowColor": { "scale": { "domain": ["tumor"], "range": ["#b2182b"] } }&#10;}</code></pre></dialog></span> |
| <span id="slot-encoding">**encoding**</span><br>[WiggleEncoding](../wiggleencoding) | The channels the marks paint through. `encoding.color` is one CSS color in `value`, or the score through a `scale` — `threshold` for solid bands, `linear` for a gradient; unset, it is the pos/neg pair about the `origin`, which a heatmap fades to from white there, and several sources in one plot box each paint their row color. `encoding.y` is the field plotted and the value axis it is drawn through: `field`, `scale`, `axis` and `rules`. `encoding.size` is a point's diameter and `encoding.strokeWidth` a line's width, in px. The row axis beside `rows` is `axis`.<br><span class="cell-more"><button type="button" class="cell-more-trigger">example</button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{&#10;&#160;&#160;"type": "LinearWiggleDisplay",&#10;&#160;&#160;"encoding": { "color": { "scale": { "type": "threshold", "domain": [2] } } }&#10;}</code></pre><pre><code>{&#10;&#160;&#160;"type": "LinearWiggleDisplay",&#10;&#160;&#160;"encoding": { "y": { "rules": [{ "value": 30, "label": "2 copies" }, 15] } }&#10;}</code></pre></dialog></span> |
| <span id="slot-data">**data**</span><br>[WiggleData](../wiggledata) | What the fetch reads, a [](/docs/config/wiggledata) object: `resolution` is the points per pixel asked of a tiered file. |
| <span id="slot-legend">**legend**</span><br>[Legend](../legend) | The key: density's score color ramp, a threshold's bands, or the source colors where several share one plot. |
| <span id="slot-axis">**axis**</span><br>[RowAxisWithGrid](../rowaxiswithgrid) | The row axis down the left of the subtrack rows: the clustering tree, each subtrack's name and the lines between rows. The value axis is `encoding.y.axis`. |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>100</code> | default height for the track |
| <span id="slot-origin">**origin**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | The value bars grow from, and the cut a threshold color scale with an empty domain uses. The same slot, with the same meaning, as the mark display's origin |
| <span id="slot-maxgapmultiple">**maxGapMultiple**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | Interpolated line only: break the line where consecutive points sit further apart than this multiple of the track's own mean point spacing, instead of drawing one long chord across the hole. Scaled to the data rather than a fixed bp distance so it holds at every zoom. 0 keeps one connected line<br>_advanced_ |
| <span id="slot-extent">**extent**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (min-max, none) = <code>'min-max'</code> | the span drawn around each bin's plotted value: 'min-max' draws the bin's stored min and max with it, as a lighter band, while `y` names a stored summary |

## Retired keys

An older config may still write these. Each loads without an error, and `jbrowse validate` reports it as stale.

<!-- prettier-ignore -->
| Key | On load |
| --- | --- |
| `scales` | moved into a current slot |
| `y` | moved into a current slot |
| `maxFeatureScreenDensity` | ignored |
| `maxDisplayedBpPerPx` | ignored |
| `fetchSizeLimit` | ignored |
| `mouseover` | ignored |
| `jexlFilters` | moved into a current slot |
| `displayCrossHatches` | moved into a current slot |
| `minimalTicks` | ignored |
| `scaleType` | moved into a current slot |
| `autoscale` | moved into a current slot |
| `minScore` | moved into a current slot |
| `maxScore` | moved into a current slot |
| `numStdDev` | ignored |
| `inverted` | ignored |
| `color` | moved into a current slot |
| `renderers` | moved into a current slot |
| `summaryScoreMode` | moved into a current slot |
| `resolution` | moved into a current slot |
| `showTree` | moved into a current slot |
| `showBranchLength` | moved into a current slot |
| `showRowLabels` | moved into a current slot |
| `treeAreaWidth` | moved into a current slot |
| `showRowSeparators` | moved into a current slot |
| `defaultRendering` | moved into a current slot |
