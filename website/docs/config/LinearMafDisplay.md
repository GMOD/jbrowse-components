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
    showRowLabels: true,
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

## Config slots

Display slots go on a display entry: `"displays": [{ "type": "LinearMafDisplay", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-fetchsizelimit">**fetchSizeLimit**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>5000000</code> | The whole budget the byte gate measures against, since no MAF adapter declares a `fetchSizeLimit`. 5 Mb, as `LinearBasicDisplay` uses, because the index estimate is block-granular. `SUB_FLOOR_BYTE_BUDGET_FACTOR` lets deep data through below the force-load floor. Measurements: `MAF_LARGE_BLOCKS.md`, "Fetch dominates at 470-way".<br>_advanced_ |
| <span id="slot-encoding">**encoding**</span><br>[MafEncoding](../mafencoding) | The channels the aligned cells paint through: `encoding.color`, the field that colors them; see [MafColor](../mafcolor).<br><span class="cell-more"><button type="button" class="cell-more-trigger">example</button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ encoding: { color: 'identity' } }</code></pre></dialog></span> |
| <span id="slot-y">**y**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (identity) | Unset, each row is one band of cells. `identity` draws each row as a bar chart of its identity to the reference, the bars painted by `encoding.color` where it is `identity` and in one color otherwise. |
| <span id="slot-rows">**rows**</span><br>[SampleRows](../samplerows) | The arrangement a reader gives the species rows, each member by row name. `sort` is the row order: the guide tree rotates to it while some rotation lists the species in that order; otherwise the listed species lead and the rest keep adapter order. `labels`, `tree`, `treeProvenance` and `kept` are what the arrangement dialog, a clustering run and a focus write. The adapter's guide tree is never written here.<br><span class="cell-more"><button type="button" class="cell-more-trigger">example</button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ rows: { sort: ['mm10'], labels: { mm10: 'Mouse' } } }</code></pre></dialog></span> |
| <span id="slot-rowcolor">**rowColor**</span><br>[RowColor](../rowcolor) | A color per species row, drawn as the bar beside its label, over the color the adapter's `samples` entry gives it.<br><span class="cell-more"><button type="button" class="cell-more-trigger">example</button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ rowColor: { scale: { domain: ['mm10'], range: ['#f28e2b'] } } }</code></pre></dialog></span> |
| <span id="slot-legend">**legend**</span><br>[Legend](../legend) | The color key for the active row rendering: codon-change categories, source-chromosome ranks, the identity ramp and the CDS frame swatches. In `bases` mode nothing draws, since there is nothing to key. |
| <span id="slot-coverage">**coverage**</span><br>[CoverageBand](../coverageband) | The coverage band: `show`, `height`, `interbase` and `minAlleleFraction`, as the alignments display spells it. |
| <span id="slot-alignments">**alignments**</span><br>[MafAlignments](../mafalignments) | The per-species rows, which take the height the bands above them leave: `show`, `rowProportion`, and the `inversions`, `frames` and `reference` parts. |
| <span id="slot-scales">**scales**</span><br>[ValueScale](../valuescale) | The coverage band's value scale, spelled as the alignments display's: `symlogConstant` 1 makes symlog `log(depth+1)`. |
| <span id="slot-conservation">**conservation**</span><br>[MafConservation](../mafconservation) | The band of identity to the reference: `show` (default off), `height` and `unit`, `base` or `codon`. |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>DEFAULTS.height</code> | display height in pixels, the bands above the rows included; the rows divide what is left while row height fits, however many there are |
| <span id="slot-rowheight">**rowHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | per-row height in px, scrolling the rows that do not fit; 0 (the default) fits the rows to the display height instead, dividing it between them |
| <span id="slot-showtree">**showTree**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | show the species tree sidebar |
| <span id="slot-showbranchlength">**showBranchLength**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | position tree nodes by branch length (dendrogram) rather than evenly by topology (cladogram) |
| <span id="slot-showrowlabels">**showRowLabels**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | draw the species name over the left of each row |
| <span id="slot-treeareawidth">**treeAreaWidth**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>80</code> | width in px of the tree sidebar, which a drag on its edge also writes |
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
| `rowProportion` | moved into a current slot |
| `showAllLetters` | ignored |
| `showAsUpperCase` | ignored |
