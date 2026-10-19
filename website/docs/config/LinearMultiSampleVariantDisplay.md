---
id: linearmultisamplevariantdisplay
title: LinearMultiSampleVariantDisplay
description: "Draws the genotypes in a multi-sample VariantTrack, one row per sample or per phased haplotype."
sidebar_label: Display -> LinearMultiSampleVariantDisplay
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `variants` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/LinearMultiSampleVariantDisplay/configSchema.ts).

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
      unit: 'haplotype',
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

Draws the genotypes in a multi-sample `VariantTrack`, one row per sample or
per phased haplotype.

## Related links

- **Adapter:** [BedpeAdapter](../bedpeadapter)
- **Adapter:** [SplitVcfTabixAdapter](../splitvcftabixadapter)
- **Adapter:** [StarFusionAdapter](../starfusionadapter)
- **Adapter:** [VcfAdapter](../vcfadapter)
- **Adapter:** [VcfTabixAdapter](../vcftabixadapter)
- **State model:** [runtime API](../../models/linearmultisamplevariantdisplay)
- **Base config:** [BaseLinearDisplay](../baselineardisplay)

## Config slots

Display slots go on a display entry: `"displays": [{ "type": "LinearMultiSampleVariantDisplay", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>200</code> | Starting height in pixels for the whole display, including any band above the rows; drag-resizable, and the rows divide what is left while row height is on auto-fit |
| <span id="slot-variantlayout">**variantLayout**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (genomic, columns) = <code>'genomic'</code> | `'genomic'` draws each variant across the bases it covers; `'columns'` draws one equal-width column per variant in view, with a line tying each column to its position. Columns keep variants a few bases apart readable at any zoom, at the cost of their lengths. The LD display takes the same slot for the same choice. |
| <span id="slot-linezoneheight">**lineZoneHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>20</code> | Height of the band of connector lines above the columns, spent only in the `'columns'` layout.<br>_advanced_ |
| <span id="slot-filter">**filter**</span><br>[VariantFilter](../variantfilter) | The variants the display draws: the jexl `expressions`, a minimum minor allele frequency and a maximum missingness. |
| <span id="slot-rows">**rows**</span><br>[SampleRows](../samplerows) | The rows are the file's samples, and the object is the arrangement a reader gives them, each member by row name: a sample in allele-count mode, a haplotype (`"<sample> HP<n>"`) in phased mode, where a sample name stands for all of its haplotypes. The samples `domain` lists come first and the rest keep the file's order; a facet groups within it. Written whole, as every display's `rows` is. |
| <span id="slot-showtooltips">**showTooltips**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Show the hover tooltip naming the genotype, the sample and the record under the pointer. Off, the crosshairs, the highlighted cell and the cross-display `session.hovered` channel stay. |
| <span id="slot-unit">**unit**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (sample, haplotype) = <code>'sample'</code> | The unit one row draws: 'sample' colors each row by allele dosage, 'haplotype' draws one row per phased haplotype |
| <span id="slot-color">**color**</span><br>[VariantCellColor](../variantcellcolor) | The hue of every genotype cell with an alt allele: unset, the genotype colors; a CSS color or `jexl:` callback; or a field, one of the `impact`, `svType` and `phaseSet` presets or any record field, whose values each take a color with a key. |
| <span id="slot-shadebydosage">**shadeByDosage**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Compose the cell hue with the genotype's alt dosage — the fraction of its called alleles that are non-reference — so a homozygote paints the hue itself and a heterozygote a lighter version of it. Off paints each alt cell its flat hue. |
| <span id="slot-showlegend">**showLegend**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Whether to draw the floating legend over the display. It is clipped to the display's own bounds, so turn it off to size a short display to its rows rather than to its key. |
| <span id="slot-rowcolor">**rowColor**</span><br>[RowColor](../rowcolor) | The bar beside each row's label: a sample-metadata attribute whose palette colors every row, or under `name` the colors a reader set row by row. |
| <span id="slot-facet">**facet**</span><br>[Facet](../facet) | A sample-metadata attribute (a column in the adapter's samplesTsvLocation, e.g. `"population"`) whose values each take a band of rows; or `{ field, domain }`, the listed values banding first and the rest sorted. Unset, the rows keep their existing order.<br><br>The band is applied when the rows are read, over whatever order the reader has arranged, so a drag that moves a sample into another band snaps back while this is set. Each band is labelled beside the tree and draws the clade of the cluster tree whose leaves are exactly its rows; a clustering run under bands clusters each band apart. |
| <span id="slot-referencedrawingmode">**referenceDrawingMode**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (draw, skip) = <code>'skip'</code> | Whether to paint reference alleles: 'skip' (the default) fills the row background solid grey and paints only ALT alleles, which makes overlapping variants easier to pick out; 'draw' paints reference alleles like any other genotype. |
| <span id="slot-showinsertionglyphs">**showInsertionGlyphs**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Widen each alt cell of an insertion to a marker sized by the inserted bp, the same one `plugins/alignments` and `plugins/maf` draw, with the bp count when the row is tall enough. An insertion consumes almost no reference, so without it a 65 kb insertion draws at the same 2px floor as a SNP. Only cells whose genotype includes the allele widen, and each keeps its genotype color. Columns have no span to correct, so this applies at genomic positions only. |
| <span id="slot-variants">**variants**</span><br>[VariantsBand](../variantsband) | The band of the variants themselves above the genotype rows, at their genomic positions: `show` (default off), `height` and `showLabels`. |
| <span id="slot-rowheight">**rowHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | per-row height in px, scrolling the rows that do not fit; 0 (the default) fits the rows to the display height instead, dividing it between them |
| <span id="slot-showtree">**showTree**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Show the sample clustering tree in the sidebar |
| <span id="slot-showbranchlength">**showBranchLength**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | position tree nodes by branch length (dendrogram) rather than evenly by topology (cladogram) |
| <span id="slot-showrowlabels">**showRowLabels**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Show the per-sample row labels in the sidebar |
| <span id="slot-treeareawidth">**treeAreaWidth**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>80</code> | width in px of the tree sidebar, which a drag on its edge also writes |
| <span id="slot-showrowseparators">**showRowSeparators**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | draw a hairline between adjacent rows; off by default, because neighbouring rows that differ in color already show a boundary and the line helps only where they match — a run of same-colored rows reads as one block without it, with no way to recover the row count by eye. Drawn only once rows are at least 4px tall: below that the line is as thick as the row it borders, turning a dense painting into a grid of hairlines with a little color between them |
| <span class="slot-group">Inherited from [BaseLinearDisplay](../baselineardisplay)</span> | <span class="slot-group-count">2 slots</span> |
| <span id="slot-fetchsizelimit">**fetchSizeLimit**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1000000</code> | maximum data to attempt to download for a given track, used if adapter doesn't specify one<br>_advanced_ |
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
| `minorAlleleFrequencyFilter` | moved into a current slot |
| `renderingMode` | moved into a current slot |
| `showSidebarLabels` | moved into a current slot |
| `showReferenceAlleles` | moved into a current slot |
| `colorBy` | ignored |
| `autoscale` | ignored |
| `minScore` | ignored |
| `maxScore` | ignored |
| `scaleType` | ignored |
| `inverted` | ignored |
| `numStdDev` | ignored |
| `minimalTicks` | ignored |
