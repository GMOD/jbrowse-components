---
id: linearmafdisplay
title: LinearMafDisplay
description: "The display for a MafTrack: one row per aligned species, with a conservation summary above them."
sidebar_label: Display -> LinearMafDisplay
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `maf` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/maf/src/LinearMafDisplay/configSchema.ts).

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
    showConservation: true,
    conservationHeight: 40,
    showRowLabels: true,
  },
}
```

The display for a `MafTrack`: one row per aligned species, with a
conservation summary above them. The slots are show/hide defaults and band
sizes; the bands and overlays derive from the alignment and toggle from the
track menu.

## Related links

- **Adapter:** [BgzipMafAdapter](../bgzipmafadapter)
- **Adapter:** [BgzipTaffyAdapter](../bgziptaffyadapter)
- **Adapter:** [BigMafAdapter](../bigmafadapter)
- **Adapter:** [MafTabixAdapter](../maftabixadapter)
- **State model:** [runtime API](../../models/linearmafdisplay)
- **Base config:** [BaseLinearDisplay](../baselineardisplay)

## Config slots

These slots go on a display entry: `"displays": [{ "type": "LinearMafDisplay", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-fetchsizelimit">**fetchSizeLimit**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>5_000_000</code> | The whole budget the byte gate measures against, since no MAF adapter declares a `fetchSizeLimit`. 5 Mb, as `LinearBasicDisplay` uses, because the index estimate is block-granular. `SUB_FLOOR_BYTE_BUDGET_FACTOR` lets deep data through below the force-load floor. Measurements: `MAF_LARGE_BLOCKS.md`, "Fetch dominates at 470-way".<br>_advanced_ |
| <span id="slot-height">**height**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) = <code>undefined</code> | Overrides the base `height` slot as a `maybeNumber`: unset fits rows to their content height, an explicit value is a drag-resized track height. See the model's `fitTargetHeight` getter. |
| <span id="slot-rowproportion">**rowProportion**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>DEFAULTS.rowProportion</code> | fraction of the row height each glyph fills |
| <span id="slot-showallletters">**showAllLetters**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>DEFAULTS.showAllLetters</code> | draw every base's letter, not only the mismatches' |
| <span id="slot-color">**color**</span><br>[MafColor](../mafcolor) | The field the aligned cells are colored by; see [MafColor](../mafcolor).<br><span class="cell-more"><button type="button" class="cell-more-trigger">example</button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ color: 'identity' }</code></pre></dialog></span> |
| <span id="slot-y">**y**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (identity) | Unset, each row is one band of cells. `identity` draws each row as a bar chart of its identity to the reference, the bars painted by `color` where it is `identity` and in one color otherwise. |
| <span id="slot-showasuppercase">**showAsUpperCase**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>DEFAULTS.showAsUpperCase</code> | uppercase all base letters |
| <span id="slot-rows">**rows**</span><br>[SampleRows](../samplerows) | The arrangement a reader gives the species rows, each member by row name. `domain` is the row order: the guide tree rotates to it while some rotation lists the species in that order; otherwise the listed species lead and the rest keep adapter order. `labels`, `tree`, `treeProvenance` and `kept` are what the arrangement dialog, a clustering run and a focus write. The adapter's guide tree is never written here.<br><span class="cell-more"><button type="button" class="cell-more-trigger">example</button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ rows: { domain: ['mm10'], labels: { mm10: 'Mouse' } } }</code></pre></dialog></span> |
| <span id="slot-rowcolor">**rowColor**</span><br>[RowColor](../rowcolor) | A color per species row, drawn as the bar beside its label, over the color the adapter's `samples` entry gives it.<br><span class="cell-more"><button type="button" class="cell-more-trigger">example</button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ rowColor: { domain: ['mm10'], range: ['#f28e2b'] } }</code></pre></dialog></span> |
| <span id="slot-showlegend">**showLegend**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Show the color key for the active row rendering: codon-change categories, source-chromosome ranks, the identity ramp and the CDS frame swatches. In `bases` mode nothing draws, since there is nothing to key. |
| <span id="slot-showcoverage">**showCoverage**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>DEFAULTS.showCoverage</code> | show the coverage band |
| <span id="slot-showalignments">**showAlignments**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>DEFAULTS.showAlignments</code> | Show the per-sample alignment rows. When off, only the coverage band renders (independent of `showCoverage`). |
| <span id="slot-coverageheight">**coverageHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>DEFAULTS.coverageHeight</code> | height of the coverage band in px |
| <span id="slot-scales">**scales**</span><br>[ValueScale](../valuescale) | The coverage band's value scale, spelled as the alignments display's: `symlogConstant` 1 makes symlog `log(depth+1)`. |
| <span id="slot-coveragesnpminfrequency">**coverageSnpMinFrequency**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | hide a coverage-band allele segment whose share of that position's depth is below this fraction; 0 colors every mismatch<br>_advanced_ |
| <span id="slot-showinterbaseindicators">**showInterbaseIndicators**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | draw the coverage band's insertion count bars and indicator triangles |
| <span id="slot-showconservation">**showConservation**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>DEFAULTS.showConservation</code> | Show the conservation band (per-bp percent identity to the reference). Independent of `showCoverage`/`showAlignments`. |
| <span id="slot-conservationheight">**conservationHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>DEFAULTS.conservationHeight</code> | height of the conservation band in px |
| <span id="slot-conservationmode">**conservationMode**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) = <code>DEFAULTS.conservationMode</code> | Conservation band resolution: `base` (per-bp percent identity) or `codon` (per-codon amino-acid identity; needs an `annotationAdapter`). |
| <span id="slot-rowidentityautozoom">**rowIdentityAutoZoom**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>DEFAULTS.rowIdentityAutoZoom</code> | When true (the default), identity, as `color` or as `y`, draws only while zoomed out, and zooming in to base level swaps it back for the bases (UCSC `wigMaf` behavior). When false identity draws at every zoom. |
| <span id="slot-showannotations">**showAnnotations**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>DEFAULTS.showAnnotations</code> | Show the per-species CDS reading-frame overlay from the configured `annotationAdapter` (UCSC `mafFrames`). No effect without one. |
| <span id="slot-showreferencerow">**showReferenceRow**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>DEFAULTS.showReferenceRow</code> | Draw the reference species as a row of its own. Under mismatch coloring every cell in it matches by definition, so UCSC omits it. The row the worker named as the reference (`refSampleId`) is the one dropped.<br><br>The row hides everywhere the row set reaches, including the FASTA "View subsequences" downloads and the per-species navigation menus. The other rows are still scored against the reference sequence. |
| <span id="slot-showinversions">**showInversions**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>DEFAULTS.showInversions</code> | Overlay a strand-flip (inversion) indicator: inverted blocks get a diagonal hatch. |
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
