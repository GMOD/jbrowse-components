---
id: linearmafdisplay
title: LinearMafDisplay
sidebar_label: Display -> LinearMafDisplay
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `maf` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/maf/src/LinearMafDisplay/configSchema.ts).

## Example usage

Set through the track's `displayDefaults`, which is what makes a track open
in this state rather than requiring every viewer to set it from the menu. A
whole-genome alignment with many species is the case worth tuning: a shorter
`rowHeight` fits more rows on screen, and the conservation band is what most
readers scan first.

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

_See the **Config slots** section below for all available configuration fields._

the display for a `MafTrack`: one row per aligned species, with a
conservation summary above them. The conservation band, per-row identity,
color-by-source-chromosome, and inversion overlays are all derived from the
alignment itself and toggled from the track menu, so the slots here are
show/hide defaults and band sizes.

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
| <span id="slot-fetchsizelimit">**fetchSizeLimit**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>5_000_000</code> | No MAF adapter declares a `fetchSizeLimit`, so this display's value is the whole budget the byte gate measures against — and MAF has no second axis behind it, since `densityTooLarge` is canvas's override and false here. It inherited the base 1 Mb until 2026-08-14, which nobody chose: `MAF_LARGE_BLOCKS.md` § "Fetch dominates at 470-way" measures a 40 kb buffered window (a 20 kb view) at 5.3 MB uncompressed for 100 rows, and real MAF-BED compresses 2.9–4.0x, so an hg38 100-way — an ordinary multiz, well inside the row count the same doc measures at 38–55fps — came to ~1.3–1.8 MB and bannered a gene-scale view it renders fine.<br><br>5 Mb for the same reason `LinearBasicDisplay` uses it: the index estimate is block-granular, so a tighter gate banners a view that isn't large. A 470-way is ~6–8 MB over that window and so still asks **above** the force-load floor — which is where asking helps, since that is the zoom range `summaryAdapter` covers and the same doc's answer for that row count is the summary tier rather than a raised budget. Below the floor `SUB_FLOOR_BYTE_BUDGET_FACTOR` lets it through, deliberately: at a locus the user navigated to, a 470-way is the same category as any other deep data, and comparable in size to the ultradeep BAM the tier was sized against.<br>_advanced_ |
| <span id="slot-height">**height**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) = <code>undefined</code> | Override the base `height` slot as a `maybeNumber`: unset means fit rows to their content height, an explicit value is a drag-resized track height. See the model's `fitTargetHeight` getter. |
| <span id="slot-rowproportion">**rowProportion**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>DEFAULTS.rowProportion</code> | fraction of the row height each glyph fills |
| <span id="slot-showallletters">**showAllLetters**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>DEFAULTS.showAllLetters</code> | draw every base letter instead of only mismatches |
| <span id="slot-mismatchrendering">**mismatchRendering**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>DEFAULTS.mismatchRendering</code> | color bases by mismatch to the reference |
| <span id="slot-showasuppercase">**showAsUpperCase**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>DEFAULTS.showAsUpperCase</code> | uppercase all base letters |
| <span id="slot-showlegend">**showLegend**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) = <code>true</code> _promotable_ | Show the color key for the active row rendering — the codon-change categories, the source-chromosome ranks, the identity ramp, and the CDS frame swatches. In `bases` mode the cells are the reference's own base colors and there is nothing to key, so nothing draws whatever this says. |
| <span id="slot-showcoverage">**showCoverage**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>DEFAULTS.showCoverage</code> | show the coverage band |
| <span id="slot-showalignments">**showAlignments**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>DEFAULTS.showAlignments</code> | Show the per-sample alignment rows. When off, only the coverage band renders (independent of `showCoverage`). |
| <span id="slot-coverageheight">**coverageHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>DEFAULTS.coverageHeight</code> | height of the coverage band in px |
| <span id="slot-showconservation">**showConservation**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>DEFAULTS.showConservation</code> | Show the conservation band (per-bp percent identity to the reference). Independent of `showCoverage`/`showAlignments`. |
| <span id="slot-conservationheight">**conservationHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>DEFAULTS.conservationHeight</code> | height of the conservation band in px |
| <span id="slot-conservationmode">**conservationMode**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) = <code>DEFAULTS.conservationMode</code> | Conservation band resolution: `base` (per-bp percent identity) or `codon` (per-codon amino-acid identity; needs an `annotationAdapter`). |
| <span id="slot-rowidentitymode">**rowIdentityMode**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (none, heatmap, xyplot) = <code>DEFAULTS.rowIdentityMode</code> | Per-row identity rendering shown once zoomed out past base level: `heatmap` shades the row band, `xyplot` draws a per-species identity wiggle, `none` keeps the base coloring at every zoom. |
| <span id="slot-rowidentityautozoom">**rowIdentityAutoZoom**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>DEFAULTS.rowIdentityAutoZoom</code> | When true (the default) the `rowIdentityMode` plot draws only while zoomed out, and zooming in to base level swaps it back for the base/SNP coloring — where individual bases are legible, the letters say more than a per-pixel mean of them. This is UCSC `wigMaf` behavior. When false the plot is pinned on at every zoom and the bases are never shown.<br><br>The slot name is the mechanism ("auto by zoom"); what a user picks is which of the two renderings they get zoomed in, which is how the menu row is worded. |
| <span id="slot-showannotations">**showAnnotations**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>DEFAULTS.showAnnotations</code> | Show the per-species CDS reading-frame overlay from the configured `annotationAdapter` (UCSC `mafFrames`). No effect without one. |
| <span id="slot-showtranslation">**showTranslation**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>DEFAULTS.showTranslation</code> | Translate each species in the reference reading frame and draw the amino acid on each codon in place of nucleotides (UCSC `wigMaf` "show translation"). Needs an `annotationAdapter`. |
| <span id="slot-colorbychromosome">**colorByChromosome**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>DEFAULTS.colorByChromosome</code> | Color each species' blocks by their source chromosome instead of the per-base SNP coloring, surfacing translocations/rearrangements. |
| <span id="slot-showinversions">**showInversions**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>DEFAULTS.showInversions</code> | Overlay a strand-flip (inversion) indicator: inverted blocks get a diagonal hatch. |
| <span id="slot-rowheight">**rowHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | per-row height in px, scrolling the rows that do not fit; 0 (the default) fits the rows to the display height instead, dividing it between them |
| <span id="slot-showtree">**showTree**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | show the species tree sidebar |
| <span id="slot-showbranchlength">**showBranchLength**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | position tree nodes by branch length (dendrogram) rather than evenly by topology (cladogram) |
| <span id="slot-showrowlabels">**showRowLabels**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | draw the species name over the left of each row |
| <span class="slot-group">Inherited from [BaseLinearDisplay](../baselineardisplay)</span> | <span class="slot-group-count">3 slots</span> |
| <span id="slot-mouseover">**mouseover**</span><br>[`string`](/docs/config_guides/slot_types#string) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>'jexl:get(feature,'_mouseOver')&#124;&#124;get(feature,'name')&#124;&#124;get(featu…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>'jexl:get(feature,'_mouseOver')&#124;&#124;get(feature,'name')&#124;&#124;get(feature,'function')&#124;&#124;get(feature,'id')'</code></pre></dialog></span> | text to display when the cursor hovers over a feature<br>_callback args:_ `feature` |
| <span id="slot-jexlfilters">**jexlFilters**</span><br>`stringArray` = <code>[]</code> | config jexlFilters are deferred evaluated so they are prepended with jexl at runtime rather than being stored with jexl in the config |
| <span id="slot-forceload">**forceLoad**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Declarative equivalent of the "Force load" button on the "too much data" banner: when true the display always renders, however large the region or dense the features. Off by default (the gate guards against huge downloads). Set it on a view no one can interact with — an embedded / notebook view, or a screenshot — where the region is known and you want it drawn without a click.<br>_advanced_ |
