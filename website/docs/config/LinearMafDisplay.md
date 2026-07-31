---
id: linearmafdisplay
title: LinearMafDisplay
sidebar_label: Display -> LinearMafDisplay
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `maf` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/maf/src/LinearMafDisplay/configSchema.ts).

the display for a `MafTrack`: one row per aligned species, with a conservation
summary above them. The conservation band, per-row identity,
color-by-source-chromosome, and inversion overlays are all derived from the
alignment itself and toggled from the track menu, so the slots here are
show/hide defaults and band sizes.

## Related links

- **Adapter:** [BgzipTaffyAdapter](../bgziptaffyadapter)
- **Adapter:** [BigMafAdapter](../bigmafadapter)
- **Adapter:** [MafTabixAdapter](../maftabixadapter)
- **State model:** [runtime API](../../models/linearmafdisplay)

## Config slots

These slots go on a display entry:
`"displays": [{ "type": "LinearMafDisplay", ... }]`, or in the track's
[`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this
is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained
in the [config slot types reference](/docs/config_guides/slot_types). Slots a
base configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-height">**height**</span><br>`maybeNumber` = <code>undefined</code> | Override the base `height` slot as a `maybeNumber`: unset means fit rows to their content height, an explicit value is a drag-resized track height. See the model's `fitTargetHeight` getter. |
| <span id="slot-rowheight">**rowHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | Per-row height in px, or `0` for "fit to display height" mode where rows stretch to fill the track height. The resolved value is the model's `effectiveRowHeight` getter. Defaults to fit-to-height so large alignments stay bounded by the track height; a pinned height is honored whatever the species count, with the rows that don't fit scrolled to. |
| <span id="slot-rowproportion">**rowProportion**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>DEFAULTS.rowProportion</code> | fraction of the row height each glyph fills |
| <span id="slot-showallletters">**showAllLetters**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>DEFAULTS.showAllLetters</code> | draw every base letter instead of only mismatches |
| <span id="slot-mismatchrendering">**mismatchRendering**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>DEFAULTS.mismatchRendering</code> | color bases by mismatch to the reference |
| <span id="slot-showasuppercase">**showAsUpperCase**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>DEFAULTS.showAsUpperCase</code> | uppercase all base letters |
| <span id="slot-showtree">**showTree**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>DEFAULTS.showTree</code> | show the species tree sidebar |
| <span id="slot-showbranchlength">**showBranchLength**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>DEFAULTS.showBranchLength</code> | Position tree nodes by their cluster merge height (dendrogram) rather than evenly by topology (cladogram). |
| <span id="slot-showcoverage">**showCoverage**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>DEFAULTS.showCoverage</code> | show the coverage band |
| <span id="slot-showalignments">**showAlignments**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>DEFAULTS.showAlignments</code> | Show the per-sample alignment rows. When off, only the coverage band renders (independent of `showCoverage`). |
| <span id="slot-coverageheight">**coverageHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>DEFAULTS.coverageHeight</code> | height of the coverage band in px |
| <span id="slot-showconservation">**showConservation**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>DEFAULTS.showConservation</code> | Show the conservation band (per-bp percent identity to the reference). Independent of `showCoverage`/`showAlignments`. |
| <span id="slot-conservationheight">**conservationHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>DEFAULTS.conservationHeight</code> | height of the conservation band in px |
| <span id="slot-conservationmode">**conservationMode**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) = <code>DEFAULTS.conservationMode</code> | Conservation band resolution: `base` (per-bp percent identity) or `codon` (per-codon amino-acid identity; needs an `annotationAdapter`). |
| <span id="slot-rowidentitymode">**rowIdentityMode**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) = <code>DEFAULTS.rowIdentityMode</code> | Per-row identity rendering shown once zoomed out past base level: `heatmap` shades the row band, `xyplot` draws a per-species identity wiggle, `none` keeps the base coloring at every zoom. |
| <span id="slot-rowidentityautozoom">**rowIdentityAutoZoom**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>DEFAULTS.rowIdentityAutoZoom</code> | When true the per-row identity plot follows zoom like UCSC `wigMaf`; when false the selected `rowIdentityMode` is pinned on at every zoom. |
| <span id="slot-showannotations">**showAnnotations**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>DEFAULTS.showAnnotations</code> | Show the per-species CDS reading-frame overlay from the configured `annotationAdapter` (UCSC `mafFrames`). No effect without one. |
| <span id="slot-showtranslation">**showTranslation**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>DEFAULTS.showTranslation</code> | Translate each species in the reference reading frame and draw the amino acid on each codon in place of nucleotides (UCSC `wigMaf` "show translation"). Needs an `annotationAdapter`. |
| <span id="slot-colorbychromosome">**colorByChromosome**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>DEFAULTS.colorByChromosome</code> | Color each species' blocks by their source chromosome instead of the per-base SNP coloring, surfacing translocations/rearrangements. |
| <span id="slot-showinversions">**showInversions**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>DEFAULTS.showInversions</code> | Overlay a strand-flip (inversion) indicator: inverted blocks get a diagonal hatch. |
