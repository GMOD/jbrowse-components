---
id: linearmafdisplay
title: LinearMafDisplay
description: "The display for a MafTrack: one row per aligned species, with a conservation summary above them."
sidebar_label: Display -> LinearMafDisplay
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `maf` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/maf/src/LinearMafDisplay/configSchema.ts).

The display for a `MafTrack`: one row per aligned species, with a
conservation summary above them. The slots are show/hide defaults and band
sizes; the bands and overlays derive from the alignment and toggle from the
track menu.

## Example usage

Set through the track's `displayDefaults`, so the track opens in this state
for every viewer.

```js
{
  type: 'MafTrack',
  trackId: 'multiz_example',
  name: 'Multiz alignment',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BigMafAdapter',
    bigBedLocation: { uri: 'https://example.com/multiz.bb' },
    samples: ['hg38', 'panTro6', 'rheMac10', 'mm39'],
  },
  displayDefaults: {
    rowHeight: 12,
    conservation: { show: true, height: 40 },
    axis: { labels: true },
  },
}
```

## Related links

- **Adapter:** [BgzipMafAdapter](../bgzipmafadapter)
- **Adapter:** [BgzipTaffyAdapter](../bgziptaffyadapter)
- **Adapter:** [BigMafAdapter](../bigmafadapter)
- **Adapter:** [MafTabixAdapter](../maftabixadapter)
- **State model:** [runtime API](../../models/linearmafdisplay)
- **Base config:** [BaseLinearDisplay](../baselineardisplay)

## Color channels

<!-- prettier-ignore -->
| Setting | Page | `scale.type` | Preset fields |
| --- | --- | --- | --- |
| `encoding.color` | [](/docs/config/mafcolor#preset-fields) | fixed by the field | `identity`, `refNameRank` |

## Config slots

Display slots go on a display entry: `"displays": [{ "type": "LinearMafDisplay", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-fetchsizelimit">**fetchSizeLimit**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>5000000</code> | The bytes a region may cost before the display stops and offers to load it anyway, the whole budget since no MAF adapter declares a `fetchSizeLimit`. 5 Mb, as `LinearBasicDisplay` uses, because the index estimate is block-granular.<br>_advanced_ |
| <span id="slot-encoding">**encoding**</span><br>[MafEncoding](../mafencoding) | The channels the aligned cells paint through: `encoding.color`, the field that colors them (see [MafColor](../mafcolor)), and `encoding.y`, the field a row's bar height shows.<br><span class="cell-more"><button type="button" class="cell-more-trigger">example</button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ encoding: { color: 'identity' } }</code></pre></dialog></span> |
| <span id="slot-axis">**axis**</span><br>[RowAxis](../rowaxis) | The guide down the left of the species rows: the species tree and each species' name. No `grid`: the rows keep a gap instead. The coverage band's value axis is `coverage.encoding.y.axis`. |
| <span id="slot-rows">**rows**</span><br>[SampleRows](../samplerows) | The arrangement a reader gives the species rows, each member by row name. `sort` is the row order: the guide tree rotates to it while some rotation lists the species in that order; otherwise the listed species lead and the rest keep adapter order. `labels`, `tree`, `treeProvenance` and `kept` are what the arrangement dialog, a clustering run and a focus write. The adapter's guide tree is never written here.<br><span class="cell-more"><button type="button" class="cell-more-trigger">example</button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ rows: { sort: ['mm10'], labels: { mm10: 'Mouse' } } }</code></pre></dialog></span> |
| <span id="slot-rowcolor">**rowColor**</span><br>[RowColor](../rowcolor) | A color per species row, drawn as the bar beside its label, over the color the adapter's `samples` entry gives it.<br><span class="cell-more"><button type="button" class="cell-more-trigger">example</button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ rowColor: { scale: { domain: ['mm10'], range: ['#f28e2b'] } } }</code></pre></dialog></span> |
| <span id="slot-legend">**legend**</span><br>[Legend](../legend) | The color key for the active row rendering: codon-change categories, source-chromosome ranks, the identity ramp and the CDS frame swatches. In `bases` mode nothing draws, since there is nothing to key. |
| <span id="slot-coverage">**coverage**</span><br>[CoverageBand](../coverageband) | The coverage band: `show`, `height`, `encoding.y`, `interbase` and `alleles`, as the alignments display spells it. |
| <span id="slot-alignments">**alignments**</span><br>[MafAlignments](../mafalignments) | The per-species rows, which take the height the bands above them leave: `show`, `rowProportion`, and the `inversions`, `frames` and `reference` parts. |
| <span id="slot-conservation">**conservation**</span><br>[MafConservation](../mafconservation) | The band of identity to the reference: `show` (default off), `height` and `unit`, `base` or `codon`. |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>300</code> | display height in pixels, the bands above the rows included; the rows divide what is left while row height fits, however many there are |
| <span id="slot-rowheight">**rowHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | per-row height in px, scrolling the rows that do not fit; 0 (the default) fits the rows to the display height instead, dividing it between them |
| <span class="slot-group">Inherited from [BaseLinearDisplay](../baselineardisplay)</span> | <span class="slot-group-count">1 slot</span> |
| <span id="slot-forceload">**forceLoad**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Declarative equivalent of the "Force load" button on the "too much data" banner: when true the display always renders, however large the region or dense the features. Off by default (the gate guards against huge downloads). Set it on a view no one can interact with — an embedded / notebook view, or a screenshot — where the region is known and you want it drawn without a click.<br>_advanced_ |

## Retired keys

An older config may still write these. Each loads without an error, and `jbrowse validate` reports it as stale.

<!-- prettier-ignore -->
| Key | On load |
| --- | --- |
| `maxFeatureScreenDensity` | ignored |
| `maxDisplayedBpPerPx` | ignored |
| `mouseover` | ignored |
| `jexlFilters` | moved into a current slot |
