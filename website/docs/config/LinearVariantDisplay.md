---
id: linearvariantdisplay
title: LinearVariantDisplay
description: "Draws a VariantTrack: its records, stacked as a feature track stacks them (records), over one genotype row per sample or per phased haplotype (genotypes)."
sidebar_label: Display -> LinearVariantDisplay
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `variants` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/LinearVariantDisplay/configSchema.ts).

Draws a `VariantTrack`: its records, stacked as a feature track stacks
them (`records`), over one genotype row per sample or per phased haplotype
(`genotypes`). A VCF with no samples draws its records alone. The
default display of a `VariantTrack`.

## Example usage

Minimal `VariantTrack` config. See the
[variant track guide](/docs/config_guides/variant_track) for all options:

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
      type: 'LinearVariantDisplay',
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
      type: 'LinearVariantDisplay',
      height: 400,
      unit: 'haplotype',
      rows: { sort: ['HG002'] },
    },
  ],
}
```

One equal-width column per variant, tied to the genome by connector lines,
for reading a genotype pattern across variants too close together to
separate at their positions:

```js
{
  type: 'LinearVariantDisplay',
  variantLayout: 'columns',
}
```

## Related links

- **Adapter:** [BedpeAdapter](../bedpeadapter)
- **Adapter:** [SplitVcfTabixAdapter](../splitvcftabixadapter)
- **Adapter:** [StarFusionAdapter](../starfusionadapter)
- **Adapter:** [VcfAdapter](../vcfadapter)
- **Adapter:** [VcfTabixAdapter](../vcftabixadapter)
- **State model:** [runtime API](../../models/linearvariantdisplay)
- **Base config:** [BaseLinearDisplay](../baselineardisplay)

## Color channels

<!-- prettier-ignore -->
| Setting | Page | `scale.type` | Preset fields |
| --- | --- | --- | --- |
| `encoding.color` | [](/docs/config/variantcellcolor#preset-fields) | ordinal, threshold, linear, log, identity | `strand`, `svType`, `impact`, `score` |

## Config slots

Display slots go on a display entry: `"displays": [{ "type": "LinearVariantDisplay", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>200</code> | Starting height in pixels for the whole display, including any band above the rows; drag-resizable, and the rows divide what is left while row height is on auto-fit |
| <span id="slot-variantlayout">**variantLayout**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (genomic, columns) = <code>'genomic'</code> | `'genomic'` draws each variant across the bases it covers; `'columns'` draws one equal-width column per variant in view, with a line tying each column to its position. Columns keep variants a few bases apart readable at any zoom, at the cost of their lengths. The LD display takes the same slot for the same choice. |
| <span id="slot-linezoneheight">**lineZoneHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>20</code> | Height of the band of connector lines above the columns, spent only in the `'columns'` layout.<br>_advanced_ |
| <span id="slot-filter">**filter**</span><br><code>fieldPredicateList()</code> | The variants the display draws, a list of [](/docs/config/fieldpredicate) entries a site must all pass: a field of the record's own, a `jexl:` expression that must hold, `minorAlleleFrequency`, the share of its called alleles the second most frequent one makes up, and `missingness`, the share of its alleles uncalled. `[{ field: "minorAlleleFrequency", gte: 0.05 }]` drops the rare variants; a site with no called allele draws nothing whatever the list says. |
| <span id="slot-axis">**axis**</span><br>[RowAxisWithGrid](../rowaxiswithgrid) | The guide down the left of the sample rows: the clustering tree, each sample's name and the lines between rows. |
| <span id="slot-rows">**rows**</span><br>[SampleRows](../samplerows) | The rows are the file's samples, and the object is the arrangement a reader gives them, each member by row name: a sample in allele-count mode, a haplotype (`"<sample> HP<n>"`) in phased mode, where a sample name stands for all of its haplotypes. The samples `sort` lists come first and the rest keep the file's order; a facet groups within it. Written whole, as every display's `rows` is. |
| <span id="slot-tooltip">**tooltip**</span><br>[SampleTooltip sub-schema](#slot-tooltipshow) | The hover tooltip naming the genotype, the sample and the record under the pointer. Off, the crosshairs, the highlighted cell and the cross-display `session.hovered` channel stay. |
| <span id="slot-tooltipshow">**tooltip.show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | show the hover tooltip over the genotype rows; the crosshairs and the hover highlight stay either way |
| <span id="slot-unit">**unit**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (sample, haplotype) = <code>'sample'</code> | The unit one row draws: 'sample' colors each row by allele dosage, 'haplotype' draws one row per phased haplotype |
| <span id="slot-encoding">**encoding**</span><br>[VariantCellEncoding](../variantcellencoding) | The genotype cells' channels: `encoding.color`, the hue of every cell with an alt allele. |
| <span id="slot-shadebydosage">**shadeByDosage**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Compose the cell hue with the genotype's alt dosage — the fraction of its called alleles that are non-reference — so a homozygote paints the hue itself and a heterozygote a lighter version of it. Off paints each alt cell its flat hue. |
| <span id="slot-legend">**legend**</span><br>[Legend](../legend) | The floating key over the display. It is clipped to the display's own bounds, so turn it off to size a short display to its rows rather than to its key. |
| <span id="slot-rowcolor">**rowColor**</span><br>[RowColor](../rowcolor) | The bar beside each row's label: a sample-metadata attribute whose palette colors every row, or under `name` the colors a reader set row by row. |
| <span id="slot-facet">**facet**</span><br>[Facet](../facet) | A sample-metadata attribute (a column in the adapter's samplesTsvLocation, e.g. `"population"`) whose values each take a band of rows; or `{ field, sort }`, the listed values banding first and the rest sorted. Unset, the rows keep their existing order.<br><br>The band is applied when the rows are read, over whatever order the reader has arranged, so a drag that moves a sample into another band snaps back while this is set. Each band is labelled beside the tree and draws the clade of the cluster tree whose leaves are exactly its rows; a clustering run under bands clusters each band apart. |
| <span id="slot-referencedrawingmode">**referenceDrawingMode**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (draw, skip) = <code>'skip'</code> | Whether to paint reference alleles: 'skip' (the default) fills the row background solid grey and paints only ALT alleles, which makes overlapping variants easier to pick out; 'draw' paints reference alleles like any other genotype. |
| <span id="slot-records">**records**</span><br>[RecordsBand](../recordsband) | The records, stacked as a feature track stacks them: over genotype rows their structural variants, colored by SV type; with no rows every record. `show` (default on), `maxHeight`, the most it takes from the rows, `labels`, and a feature track's record settings: `displayMode`, `mark`, `facet`, `maxFeatureScreenDensity` and `tooltip.field`. |
| <span id="slot-genotypes">**genotypes**</span><br>[GenotypeRows sub-schema](#slot-genotypesshow) | The genotype rows. Off, the display reads no genotypes and draws as it does for a VCF with no samples: the records alone, every one the filter admits, sized by `heightMode`. |
| <span id="slot-genotypesshow">**genotypes.show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | draw a row per sample; off, the display draws the records alone, as for a VCF with no samples |
| <span id="slot-rowheight">**rowHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | per-row height in px, scrolling the rows that do not fit; 0 (the default) fits the rows to the display height instead, dividing it between them |
| <span id="slot-heightmode">**heightMode**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (fixed, grow, fit) = <code>'fit'</code> | Track-sizing strategy while no genotype rows draw (no samples, or `genotypes.show` off), as on a feature track: `fit` keeps the track height and gives up labels, then squeezes the records; `fixed` keeps the track height at full record size; `grow` sizes the track to its records up to `growMaxHeight`. With genotype rows the track keeps its `height` |
| <span id="slot-growmaxheight">**growMaxHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>800</code> | Ceiling in pixels for `heightMode: 'grow'`<br>_advanced_ |
| <span class="slot-group">Inherited from [BaseLinearDisplay](../baselineardisplay)</span> | <span class="slot-group-count">2 slots</span> |
| <span id="slot-fetchsizelimit">**fetchSizeLimit**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1000000</code> | bytes a region may fetch before the display asks first; an adapter that sets its own limit overrides this<br>_advanced_ |
| <span id="slot-forceload">**forceLoad**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Declarative equivalent of the "Force load" button on the "too much data" banner: when true the display always renders, however large the region or dense the features. Off by default (the gate guards against huge downloads). Set it on a view no one can interact with — an embedded / notebook view, or a screenshot — where the region is known and you want it drawn without a click.<br>_advanced_ |

## Retired keys

An older config may still write these. Each loads without an error, and `jbrowse validate` reports it as stale.

<!-- prettier-ignore -->
| Key | On load |
| --- | --- |
| `maxFeatureScreenDensity` | moved into a current slot |
| `maxDisplayedBpPerPx` | ignored |
| `mouseover` | moved into a current slot |
| `jexlFilters` | moved into a current slot |
| `renderer` | moved into a current slot |
| `featureHeight` | moved into a current slot |
| `showLabels` | moved into a current slot |
| `showDescriptions` | moved into a current slot |
| `color1` | moved into a current slot |
| `maxHeight` | ignored |
| `renderingMode` | moved into a current slot |
| `showSidebarLabels` | moved into a current slot |
| `showTree` | moved into a current slot |
| `showReferenceAlleles` | moved into a current slot |
| `colorBy` | moved into a current slot |
| `autoscale` | ignored |
| `minScore` | ignored |
| `maxScore` | ignored |
| `scaleType` | ignored |
| `inverted` | ignored |
| `numStdDev` | ignored |
| `minimalTicks` | ignored |
| `minorAlleleFrequencyFilter` | moved into a current slot |
