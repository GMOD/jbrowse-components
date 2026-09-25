---
id: linearmultisamplevariantdisplay
title: LinearMultiSampleVariantDisplay
sidebar_label: Display -> LinearMultiSampleVariantDisplay
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `variants` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/LinearMultiSampleVariantDisplay/configSchema.ts).

## Example usage

Minimal `VariantTrack` config selecting this display type. The `displays`
array form is required here (rather than the object shorthand) because
this is a non-default display type — see
[configuring displays](/docs/config_guides/tracks#configuring-displays):

```js
{
  type: 'VariantTrack',
  trackId: 'cohort',
  name: 'Cohort variants',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'VcfTabixAdapter',
    uri: 'https://example.com/cohort.vcf.gz',
  },
  displays: [
    {
      type: 'LinearMultiSampleVariantDisplay',
    },
  ],
}
```

Preloading sample metadata: point the adapter's `samplesTsvLocation` at a TSV
whose first column is the sample name and whose other columns are per-sample
attributes (e.g. `population`), then `rowColor` one of those attributes to
color the sidebar rows on load. `referenceDrawingMode: 'skip'` (the default)
paints the background solid grey and draws only ALT alleles on top, which
makes overlapping structural variants easier to see; `'draw'` paints the
reference alleles too. This is the 1000 Genomes "colored by population" demo
config:

```js
{
  type: 'VariantTrack',
  trackId: 'cohort',
  name: 'Cohort variants',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'VcfTabixAdapter',
    uri: 'https://example.com/cohort.vcf.gz',
    samplesTsvLocation: { uri: 'https://example.com/samples.tsv' },
  },
  displays: [
    {
      type: 'LinearMultiSampleVariantDisplay',
      height: 800,
      rowColor: 'population',
      referenceDrawingMode: 'skip',
    },
  ],
}
```

Phased haplotype rows, one per haplotype of each sample. `rows` arranges
them by sample name, so the order below puts both of HG002's rows first:

```js
{
  type: 'VariantTrack',
  trackId: 'cohort',
  name: 'Cohort variants',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'VcfTabixAdapter',
    uri: 'https://example.com/cohort.vcf.gz',
  },
  displays: [
    {
      type: 'LinearMultiSampleVariantDisplay',
      height: 400,
      renderingMode: 'phased',
      rows: { domain: ['HG002'] },
    },
  ],
}
```

One equal-width column per variant, tied to the genome by connector lines,
for reading a genotype pattern across variants too close together to
separate at their positions:

```js
{
  type: 'LinearMultiSampleVariantDisplay',
  variantLayout: 'columns',
}
```

_See the **Config slots** section below for all available configuration fields._

## Related links

- **Adapter:** [BedpeAdapter](../bedpeadapter)
- **Adapter:** [SplitVcfTabixAdapter](../splitvcftabixadapter)
- **Adapter:** [StarFusionAdapter](../starfusionadapter)
- **Adapter:** [VcfAdapter](../vcfadapter)
- **Adapter:** [VcfTabixAdapter](../vcftabixadapter)
- **State model:** [runtime API](../../models/linearmultisamplevariantdisplay)
- **Base config:** [BaseLinearDisplay](../baselineardisplay)

## Config slots

These slots go on a display entry: `"displays": [{ "type": "LinearMultiSampleVariantDisplay", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>200</code> | Starting height in pixels for the whole display, including any band above the rows; drag-resizable, and the rows divide what is left while row height is on auto-fit |
| <span id="slot-variantlayout">**variantLayout**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (genomic, columns) = <code>'genomic'</code> | `'genomic'` draws each variant across the bases it covers; `'columns'` draws one equal-width column per variant in view, with a line tying each column to its position. Columns keep variants a few bases apart readable at any zoom, at the cost of their lengths. The LD display takes the same slot for the same choice. |
| <span id="slot-linezoneheight">**lineZoneHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>20</code> | Height of the band of connector lines above the columns, spent only in the `'columns'` layout.<br>_advanced_ |
| <span id="slot-rows">**rows**</span><br>[RowArrangement](../rowarrangement) | The arrangement a reader gives the rows, each member by row name: a sample in allele-count mode, a haplotype (`"<sample> HP<n>"`) in phased mode, where a sample name stands for all of its haplotypes. The samples `domain` lists come first and the rest keep the file's order; a facet groups within it. |
| <span id="slot-showtooltips">**showTooltips**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Show the hover tooltip naming the genotype, the sample and the record under the pointer. Off, the crosshairs, the highlighted cell and the cross-display `session.hovered` channel stay. |
| <span id="slot-renderingmode">**renderingMode**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (alleleCount, phased) = <code>'alleleCount'</code> | 'alleleCount' draws one row per sample colored by allele dosage; 'phased' draws one row per haplotype |
| <span id="slot-color">**color**</span><br>[VariantCellColor](../variantcellcolor) | The hue of every alt-carrying genotype cell: unset, the genotype colours; a CSS colour or `jexl:` callback; or a field, one of the `impact`, `svType` and `phaseSet` presets or any record field, whose values each take a colour with a key. |
| <span id="slot-shadebydosage">**shadeByDosage**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Compose the cell hue with the genotype's alt dosage — the fraction of its called alleles that are non-reference — so a homozygote paints the hue itself and a heterozygote a lighter version of it. Off paints each alt-carrying cell its flat hue. |
| <span id="slot-minorallelefrequencyfilter">**minorAlleleFrequencyFilter**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | Hide variants whose minor allele frequency is below this threshold<br>_advanced_ |
| <span id="slot-maxmissingnessfilter">**maxMissingnessFilter**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | Hide variants whose fraction of no-call (missing) genotypes is above this threshold; 1 keeps every variant<br>_advanced_ |
| <span id="slot-showlegend">**showLegend**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Whether to draw the floating legend over the display. It is clipped to the display's own bounds, so turn it off to size a short display to its rows rather than to its key. |
| <span id="slot-rowcolor">**rowColor**</span><br>[RowColor](../rowcolor) | The tint beside each row's label: a sample-metadata attribute whose palette tints every row, or under `name` the colours a reader set row by row. |
| <span id="slot-facet">**facet**</span><br>[Facet](../facet) | A sample-metadata attribute (a column in the adapter's samplesTsvLocation, e.g. `"population"`) whose values each take their own band of rows; or `{ field, domain }`, the listed values banding first and the rest sorted. Unset, the rows keep their existing order.<br><br>The band is applied when the rows are read, over whatever order the reader has arranged, so a drag that moves a sample into another band snaps back while this is set. Each band is labelled beside the tree and draws the clade of the cluster tree whose leaves are exactly its rows; a clustering run under bands clusters each band apart. |
| <span id="slot-referencedrawingmode">**referenceDrawingMode**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (draw, skip) = <code>'skip'</code> | Whether to paint reference alleles: 'skip' (the default) fills the row background solid grey and paints only ALT alleles, which makes overlapping variants easier to pick out; 'draw' paints reference alleles like any other genotype. |
| <span id="slot-showinsertionglyphs">**showInsertionGlyphs**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Widen each alt-carrying cell of an insertion to a marker sized by the inserted bp, the same one `plugins/alignments` and `plugins/maf` draw, with the bp count when the row is tall enough. An insertion consumes almost no reference, so without it a 65 kb insertion draws at the same 2px floor as a SNP. Only cells whose genotype carries the allele widen, and each keeps its genotype color. Columns have no span to correct, so this applies at genomic positions only. |
| <span id="slot-showvariantlane">**showVariantLane**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Draw a `LinearVariantDisplay`-style lane above the genotype rows: one mark per record at its genomic span, colored by whatever "Color by → Cells" is set to, drawn by that display's own band code. Overlapping records stack while the band has room and share a row once it has not; hovering a mark reports the record, clicking opens its details, and right-clicking opens the menu a genotype cell does. At genomic positions only. |
| <span id="slot-variantlaneheight">**variantLaneHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>40</code> | Height of the variant lane, spent only while `showVariantLane` is on.<br>_advanced_ |
| <span id="slot-variantlanelabels">**variantLaneLabels**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (auto, nameAndDescription, name, description, none) = <code>'auto'</code> | Letter the lane's marks with each record's VCF ID and/or its description, as a `LinearVariantDisplay` letters the same record. What the band has room for is decided by that display's fit ladder: descriptions go first, then IDs are thinned, then dropped. |
| <span id="slot-jexlfilters">**jexlFilters**</span><br>`stringArray` = <code>[]</code> | default set of jexl filters to apply to a track. note: these do not use the jexl prefix because they have a deferred evaluation system |
| <span id="slot-rowheight">**rowHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | per-row height in px, scrolling the rows that do not fit; 0 (the default) fits the rows to the display height instead, dividing it between them |
| <span id="slot-showtree">**showTree**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Show the sample clustering tree in the sidebar |
| <span id="slot-showbranchlength">**showBranchLength**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | position tree nodes by branch length (dendrogram) rather than evenly by topology (cladogram) |
| <span id="slot-showrowlabels">**showRowLabels**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Show the per-sample row labels in the sidebar |
| <span id="slot-treeareawidth">**treeAreaWidth**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>80</code> | width in px of the tree sidebar, which a drag on its edge also writes |
| <span id="slot-showrowseparators">**showRowSeparators**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | draw a hairline between adjacent rows; off by default, because a painting whose neighbouring rows differ in color already separates itself and the line only earns its pixel where they do not — a run of same-colored rows reads as one block without it, with no way to recover the row count by eye. Drawn only once rows are at least 4px tall: below that the line is as thick as the row it borders, turning a dense painting into a grid of hairlines with a little color between them |
| <span class="slot-group">Inherited from [BaseLinearDisplay](../baselineardisplay)</span> | <span class="slot-group-count">3 slots</span> |
| <span id="slot-mouseover">**mouseover**</span><br>[`string`](/docs/config_guides/slot_types#string) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>'jexl:get(feature,'_mouseOver')&#124;&#124;get(feature,'name')&#124;&#124;get(featu…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>'jexl:get(feature,'_mouseOver')&#124;&#124;get(feature,'name')&#124;&#124;get(feature,'function')&#124;&#124;get(feature,'id')'</code></pre></dialog></span> | text to display when the cursor hovers over a feature<br>_callback args:_ `feature` |
| <span id="slot-fetchsizelimit">**fetchSizeLimit**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1_000_000</code> | maximum data to attempt to download for a given track, used if adapter doesn't specify one<br>_advanced_ |
| <span id="slot-forceload">**forceLoad**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Declarative equivalent of the "Force load" button on the "too much data" banner: when true the display always renders, however large the region or dense the features. Off by default (the gate guards against huge downloads). Set it on a view no one can interact with — an embedded / notebook view, or a screenshot — where the region is known and you want it drawn without a click.<br>_advanced_ |
