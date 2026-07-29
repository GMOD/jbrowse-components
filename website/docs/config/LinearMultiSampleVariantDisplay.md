---
id: linearmultisamplevariantdisplay
title: LinearMultiSampleVariantDisplay
sidebar_label: Display -> LinearMultiSampleVariantDisplay
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `variants`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/LinearMultiSampleVariantDisplay/configSchema.ts).

## Example usage

Minimal `VariantTrack` config selecting this display type. The `displays` array
form is required here (rather than the object shorthand) because this is a
non-default display type — see
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
attributes (e.g. `population`), then `colorBy` one of those attributes to color
the sidebar rows on load. `showReferenceAlleles: false` paints the background
solid grey and draws only ALT alleles on top, which makes overlapping structural
variants easier to see. This is the 1000 Genomes "colored by population" demo
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
      colorBy: 'population',
      showReferenceAlleles: false,
    },
  ],
}
```

Taller track, phased haplotype rows, with pre-declared sample colors and groups.
`layout` seeds the initial sample order, color, and group labels (used for
sidebar coloring) inline instead of from a `samplesTsvLocation`:

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
      layout: [
        { name: 'HG001', color: '#e41a1c', group: 'case' },
        { name: 'HG002', color: '#377eb8', group: 'control' },
        { name: 'HG003', color: '#4daf4a', group: 'control' },
      ],
    },
  ],
}
```

_See the **Config slots** section below for all available configuration fields._

## Related links

- **Adapter:** [BedpeAdapter](../bedpeadapter)
- **Adapter:** [StarFusionAdapter](../starfusionadapter)
- **Adapter:** [SplitVcfTabixAdapter](../splitvcftabixadapter)
- **Adapter:** [VcfAdapter](../vcfadapter)
- **Adapter:** [VcfTabixAdapter](../vcftabixadapter)
- **State model:** [runtime API](../../models/linearmultisamplevariantdisplay)
- **Base config:** [SharedVariantDisplay](../sharedvariantdisplay)

## Config slots

These slots go on a display entry:
`"displays": [{ "type": "LinearMultiSampleVariantDisplay", ... }]`, or in the
track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays)
when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are
explained in the [config slot types reference](/docs/config_guides/slot_types).
Slots a base configuration contributes are listed here too, so this table is the
whole surface.

<!-- prettier-ignore -->
| Slot | Description | From |
| --- | --- | --- |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>200</code> | Starting height in pixels for the genotype rows; drag-resizable, and the rows divide it while row height is on auto-fit |  |
| <span id="slot-showinsertionglyphs">**showInsertionGlyphs**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Widen each alt-carrying cell of an insertion to a marker sized by the inserted bp, the same one `plugins/alignments` and `plugins/maf` draw, with the bp count when the row is tall enough.<br><br>A cell is drawn across the reference the record covers, with a 2px floor. That is right for a SNP and right for a deletion, but an insertion consumes almost no reference, so a 65 kb insertion and a SNP both land on that floor and the structural tier of a pangenome callset becomes unreadable. Only cells whose genotype carries the allele widen, and each keeps its genotype color, so the marker adds length without displacing what the color already says.<br><br>This display only: it draws every cell at its genomic position, so a width there is a claim about length. `LinearMultiSampleVariantMatrixDisplay` lays its columns out by feature index at a uniform width, so it has no such width to correct. |  |
| <span id="slot-showreferencealleles">**showReferenceAlleles**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Starting value for drawing reference alleles. When false, the row background is filled solid grey and only ALT alleles are painted on top (makes overlapping variants easier to see); when true, reference alleles are drawn normally. Seeds referenceDrawingMode the first time a config is loaded. | [SharedVariantDisplay](../sharedvariantdisplay) |
| <span id="slot-showsidebarlabels">**showSidebarLabels**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Show the per-sample row labels in the sidebar | [SharedVariantDisplay](../sharedvariantdisplay) |
| <span id="slot-linezoneheight">**lineZoneHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | Height of the zone above the rows holding the lines that tie each matrix column to its genomic position. 0 (the default here) means no zone at all — only the matrix display, which lays columns out by feature index rather than at their genomic positions, raises it.<br>_advanced_ | [SharedVariantDisplay](../sharedvariantdisplay) |
| <span id="slot-showtree">**showTree**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Show the sample clustering tree in the sidebar | [SharedVariantDisplay](../sharedvariantdisplay) |
| <span id="slot-showbranchlength">**showBranchLength**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Draw the clustering tree with branch lengths | [SharedVariantDisplay](../sharedvariantdisplay) |
| <span id="slot-renderingmode">**renderingMode**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (alleleCount, phased) = <code>'alleleCount'</code> | 'alleleCount' draws one row per sample colored by allele dosage; 'phased' draws one row per haplotype | [SharedVariantDisplay](../sharedvariantdisplay) |
| <span id="slot-featurecolor">**featureColor**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | Optional per-feature color for the genotype cells: a jexl expression (or plain CSS color) evaluated once per variant in the worker, painting every alt-carrying cell with that color while ref/no-call cells keep their normal coloring so "who carries it" still reads. Empty means the default genotype-based coloring (allele dosage / phasing). The "Color by..." menu offers presets like consequence impact (`jexl:impactColor(feature)`), but any feature jexl works, same as the standard `color` slot. | [SharedVariantDisplay](../sharedvariantdisplay) |
| <span id="slot-minorallelefrequencyfilter">**minorAlleleFrequencyFilter**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | Hide variants whose minor allele frequency is below this threshold<br>_advanced_ | [SharedVariantDisplay](../sharedvariantdisplay) |
| <span id="slot-maxmissingnessfilter">**maxMissingnessFilter**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | Hide variants whose fraction of no-call (missing) genotypes is above this threshold; 1 keeps every variant<br>_advanced_ | [SharedVariantDisplay](../sharedvariantdisplay) |
| <span id="slot-colorby">**colorBy**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | Name of a sample-metadata attribute (a column in the adapter's samplesTsvLocation, e.g. 'population') to color the sidebar rows by; empty means no grouping | [SharedVariantDisplay](../sharedvariantdisplay) |
| <span id="slot-groupby">**groupBy**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | Name of a sample-metadata attribute (a column in the adapter's samplesTsvLocation, e.g. 'population') to order the sample rows by, so each group's rows are contiguous and a group-restricted genotype pattern reads as one band; empty means the rows keep their existing order | [SharedVariantDisplay](../sharedvariantdisplay) |
| <span id="slot-referencedrawingmode">**referenceDrawingMode**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (draw, skip) = <code>'skip'</code> | A 'draw'/'skip' toggle for reference alleles, settable independent of showReferenceAlleles (the admin-config-only starting default). No fallback derivation at read time — preProcessSnapshot below seeds this from showReferenceAlleles once, the first time a config lacking it is hydrated, so from then on this slot alone is the single source of truth. | [SharedVariantDisplay](../sharedvariantdisplay) |
| <span id="slot-maxfeaturescreendensity">**maxFeatureScreenDensity**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | maximum features per pixel before showing a "too many features" message, used if byte size estimates are not available<br>_advanced_ | [BaseLinearDisplay](../baselineardisplay) |
| <span id="slot-fetchsizelimit">**fetchSizeLimit**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1_000_000</code> | maximum data to attempt to download for a given track, used if adapter doesn't specify one<br>_advanced_ | [BaseLinearDisplay](../baselineardisplay) |
| <span id="slot-forceload">**forceLoad**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Declarative equivalent of the "Force load" button on the "too much data" banner: when true the display always renders, however large the region or dense the features. Off by default (the gate guards against huge downloads). Set it on a view no one can interact with — an embedded / notebook view, or a screenshot — where the region is known and you want it drawn without a click.<br>_advanced_ | [BaseLinearDisplay](../baselineardisplay) |
| <span id="slot-mouseover">**mouseover**</span><br>[`string`](/docs/config_guides/slot_types#string) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>'jexl:get(feature,'_mouseOver')&#124;&#124;get(feature,'name')&#124;&#124;get(featu…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>'jexl:get(feature,'_mouseOver')&#124;&#124;get(feature,'name')&#124;&#124;get(feature,'function')&#124;&#124;get(feature,'id')'</code></pre></dialog></span> | text to display when the cursor hovers over a feature<br>_callback args:_ `feature` | [BaseLinearDisplay](../baselineardisplay) |
| <span id="slot-jexlfilters">**jexlFilters**</span><br>`stringArray` = <code>[`get(feature,'gbkey')!='Src'`]</code> | config jexlFilters are deferred evaluated so they are prepended with jexl at runtime rather than being stored with jexl in the config | [BaseLinearDisplay](../baselineardisplay) |
