import { ConfigurationSchema } from '@jbrowse/core/configuration'
import baseLinearDisplayConfigSchema from '@jbrowse/display-kit/configSchema'
import { facetConfigSchema } from '@jbrowse/display-kit/facetConfigSchema'
import { jexlFilterConfigSchemaFields } from '@jbrowse/display-kit/jexlFilterConfigSchemaFields'
import { rowArrangementConfigSchema } from '@jbrowse/display-kit/rowArrangementConfigSchema'
import { rowColorConfigSchema } from '@jbrowse/display-kit/rowColorConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'
import { SHOW_LABELS_MODES } from '@jbrowse/plugin-canvas'
import { rowHeightConfigSchemaFields } from '@jbrowse/tree-sidebar/rowHeightConfigSchemaFields'
import {
  rowSeparatorsConfigSchemaFields,
  treeSidebarConfigSchemaFields,
} from '@jbrowse/tree-sidebar/treeSidebarConfigSchemaFields'

import { cellColorConfigSchema } from '../shared/cellColorConfigSchema.ts'
import { MULTI_SAMPLE_VARIANT_DISPLAY } from '../shared/constants.ts'
import { DEFAULT_VARIANT_LANE_HEIGHT } from '../shared/variantTopBands.ts'

/**
 * #config LinearMultiSampleVariantDisplay
 *
 * #example
 * Minimal `VariantTrack` config selecting this display type. The `displays`
 * array form is required here (rather than the object shorthand) because
 * this is a non-default display type — see
 * [configuring displays](/docs/config_guides/tracks#configuring-displays):
 * ```js
 * {
 *   type: 'VariantTrack',
 *   trackId: 'cohort',
 *   name: 'Cohort variants',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'VcfTabixAdapter',
 *     uri: 'https://example.com/cohort.vcf.gz',
 *   },
 *   displays: [
 *     {
 *       type: 'LinearMultiSampleVariantDisplay',
 *     },
 *   ],
 * }
 * ```
 *
 * #example
 * Preloading sample metadata: point the adapter's `samplesTsvLocation` at a TSV
 * whose first column is the sample name and whose other columns are per-sample
 * attributes (e.g. `population`), then `rowColor` one of those attributes to
 * color the sidebar rows on load. `referenceDrawingMode: 'skip'` (the default)
 * paints the background solid grey and draws only ALT alleles on top, which
 * makes overlapping structural variants easier to see; `'draw'` paints the
 * reference alleles too. This is the 1000 Genomes "colored by population" demo
 * config:
 * ```js
 * {
 *   type: 'VariantTrack',
 *   trackId: 'cohort',
 *   name: 'Cohort variants',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'VcfTabixAdapter',
 *     uri: 'https://example.com/cohort.vcf.gz',
 *     samplesTsvLocation: { uri: 'https://example.com/samples.tsv' },
 *   },
 *   displays: [
 *     {
 *       type: 'LinearMultiSampleVariantDisplay',
 *       height: 800,
 *       rowColor: 'population',
 *       referenceDrawingMode: 'skip',
 *     },
 *   ],
 * }
 * ```
 *
 * #example
 * Phased haplotype rows, one per haplotype of each sample. `rows` arranges
 * them by sample name, so the order below puts both of HG002's rows first:
 * ```js
 * {
 *   type: 'VariantTrack',
 *   trackId: 'cohort',
 *   name: 'Cohort variants',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'VcfTabixAdapter',
 *     uri: 'https://example.com/cohort.vcf.gz',
 *   },
 *   displays: [
 *     {
 *       type: 'LinearMultiSampleVariantDisplay',
 *       height: 400,
 *       renderingMode: 'phased',
 *       rows: { domain: ['HG002'] },
 *     },
 *   ],
 * }
 * ```
 *
 * #example
 * One equal-width column per variant, tied to the genome by connector lines,
 * for reading a genotype pattern across variants too close together to
 * separate at their positions:
 * ```js
 * {
 *   type: 'LinearMultiSampleVariantDisplay',
 *   variantLayout: 'columns',
 * }
 * ```
 */
export default function configSchemaFactory() {
  return ConfigurationSchema(
    MULTI_SAMPLE_VARIANT_DISPLAY,
    {
      /**
       * #slot
       */
      height: {
        type: 'number',
        defaultValue: 200,
        description:
          'Starting height in pixels for the whole display, including any band above the rows; drag-resizable, and the rows divide what is left while row height is on auto-fit',
      },
      /**
       * #slot
       * `'genomic'` draws each variant across the bases it covers;
       * `'columns'` draws one equal-width column per variant in view, with a
       * line tying each column to its position. Columns keep variants a few
       * bases apart readable at any zoom, at the cost of their lengths. The LD
       * display takes the same slot for the same choice.
       */
      variantLayout: {
        type: 'stringEnum',
        model: types.enumeration('VariantLayout', ['genomic', 'columns']),
        defaultValue: 'genomic',
        description:
          "'genomic' draws each variant at its span; 'columns' draws one equal-width column per variant, tied to its position by a connector line",
      },
      /**
       * #slot
       * Height of the band of connector lines above the columns, spent only
       * in the `'columns'` layout.
       */
      lineZoneHeight: {
        type: 'number',
        defaultValue: 20,
        advanced: true,
      },
      ...jexlFilterConfigSchemaFields,
      ...rowHeightConfigSchemaFields(),
      ...treeSidebarConfigSchemaFields({
        tree: 'Show the sample clustering tree in the sidebar',
        rowLabels: 'Show the per-sample row labels in the sidebar',
      }),
      /**
       * #slot rows
       * The arrangement a reader gives the rows, each member by row name: a
       * sample in allele-count mode, a haplotype (`"<sample> HP<n>"`) in phased
       * mode, where a sample name stands for all of its haplotypes. The
       * samples `domain` lists come first and the rest keep the file's order; a
       * facet groups within it.
       */
      rows: rowArrangementConfigSchema,
      ...rowSeparatorsConfigSchemaFields(),
      /**
       * #slot
       * Show the hover tooltip naming the genotype, the sample and the record
       * under the pointer. Off, the crosshairs, the highlighted cell and the
       * cross-display `session.hovered` channel stay.
       */
      showTooltips: {
        type: 'boolean',
        defaultValue: true,
        description:
          'show the hover tooltip over the genotype rows; the crosshairs and the hover highlight stay either way',
      },
      /**
       * #slot
       */
      renderingMode: {
        type: 'stringEnum',
        model: types.enumeration('RenderingMode', ['alleleCount', 'phased']),
        defaultValue: 'alleleCount',
        description:
          "'alleleCount' draws one row per sample colored by allele dosage; 'phased' draws one row per haplotype",
      },
      /**
       * #slot color
       * The hue of every alt-carrying genotype cell: unset, the genotype
       * colours; a CSS colour or `jexl:` callback; or a field, one of the
       * `impact`, `svType` and `phaseSet` presets or any record field, whose
       * values each take a colour with a key.
       */
      color: cellColorConfigSchema,
      /**
       * #slot
       * Compose the cell hue with the genotype's alt dosage — the fraction of
       * its called alleles that are non-reference — so a homozygote paints the
       * hue itself and a heterozygote a lighter version of it. Off paints each
       * alt-carrying cell its flat hue.
       */
      shadeByDosage: {
        type: 'boolean',
        defaultValue: true,
        description:
          "shade each alt cell by the fraction of its called alleles that are non-reference, so a homozygote is darker than a heterozygote; off paints every alt cell the mode's flat hue",
      },
      /**
       * #slot
       */
      minorAlleleFrequencyFilter: {
        type: 'number',
        defaultValue: 0,
        advanced: true,
        description:
          'Hide variants whose minor allele frequency is below this threshold',
      },
      /**
       * #slot
       */
      maxMissingnessFilter: {
        type: 'number',
        defaultValue: 1,
        advanced: true,
        description:
          'Hide variants whose fraction of no-call (missing) genotypes is above this threshold; 1 keeps every variant',
      },
      /**
       * #slot
       * Whether to draw the floating legend over the display. It is clipped to
       * the display's own bounds, so turn it off to size a short display to its
       * rows rather than to its key.
       */
      showLegend: {
        type: 'boolean',
        description:
          'Whether to show the floating legend over the display; turn it off to size a short display to its rows rather than to its key. Defaults to on',
        defaultValue: true,
      },
      /**
       * #slot rowColor
       * The tint beside each row's label: a sample-metadata attribute whose
       * palette tints every row, or under `name` the colours a reader set row
       * by row.
       */
      rowColor: rowColorConfigSchema,
      /**
       * #slot facet
       * A sample-metadata attribute (a column in the adapter's
       * samplesTsvLocation, e.g. `"population"`) whose values each take their
       * own band of rows; or `{ field, domain }`, the listed values banding
       * first and the rest sorted. Unset, the rows keep their existing order.
       *
       * The band is applied when the rows are read, over whatever order the
       * reader has arranged, so a drag that moves a sample into another band
       * snaps back while this is set. Each band is labelled beside the tree
       * and draws the clade of the cluster tree whose leaves are exactly its
       * rows; a clustering run under bands clusters each band apart.
       */
      facet: facetConfigSchema,
      /**
       * #slot
       * Whether to paint reference alleles: 'skip' (the default) fills the row
       * background solid grey and paints only ALT alleles, which makes
       * overlapping variants easier to pick out; 'draw' paints reference
       * alleles like any other genotype.
       */
      referenceDrawingMode: {
        type: 'stringEnum',
        model: types.enumeration('ReferenceDrawingMode', ['draw', 'skip']),
        defaultValue: 'skip',
        description:
          "whether to paint reference alleles: 'skip' (the default) fills the row background solid grey and paints only ALT alleles, which makes overlapping variants easier to pick out; 'draw' paints reference alleles like any other genotype",
      },
      /**
       * #slot
       * Widen each alt-carrying cell of an insertion to a marker sized by the
       * inserted bp, the same one `plugins/alignments` and `plugins/maf` draw,
       * with the bp count when the row is tall enough. An insertion consumes
       * almost no reference, so without it a 65 kb insertion draws at the same
       * 2px floor as a SNP. Only cells whose genotype carries the allele widen,
       * and each keeps its genotype color. Columns have no span to correct, so
       * this applies at genomic positions only.
       */
      showInsertionGlyphs: {
        type: 'boolean',
        defaultValue: true,
        description:
          'widen insertion cells to a marker sized by the inserted bp, instead of drawing them at the 2px floor like a SNP',
      },
      /**
       * #slot
       * Draw a `LinearVariantDisplay`-style lane above the genotype rows: one
       * mark per record at its genomic span, colored by whatever "Color by →
       * Cells" is set to, drawn by that display's own band code. Overlapping
       * records stack while the band has room and share a row once it has
       * not; hovering a mark reports the record, clicking opens its details,
       * and right-clicking opens the menu a genotype cell does. At genomic
       * positions only.
       */
      showVariantLane: {
        type: 'boolean',
        defaultValue: false,
        description:
          'draw a lane of the variants themselves above the genotype rows, at their genomic positions',
      },
      /**
       * #slot
       * Height of the variant lane, spent only while `showVariantLane` is on.
       */
      variantLaneHeight: {
        type: 'number',
        defaultValue: DEFAULT_VARIANT_LANE_HEIGHT,
        advanced: true,
      },
      /**
       * #slot
       * Letter the lane's marks with each record's VCF ID and/or its
       * description, as a `LinearVariantDisplay` letters the same record. What
       * the band has room for is decided by that display's fit ladder:
       * descriptions go first, then IDs are thinned, then dropped.
       */
      variantLaneLabels: {
        type: 'stringEnum',
        model: types.enumeration('variantLaneLabels', [...SHOW_LABELS_MODES]),
        defaultValue: 'auto',
        description:
          "which label text the variant lane draws beside each mark: the record's ID and/or its description, in plugin-canvas's own vocabulary. 'auto' admits both — the lane has no density thresholds of its own, so adaptivity is its collision cull",
      },
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: baseLinearDisplayConfigSchema,
      explicitlyTyped: true,
      preProcessSnapshot: snap => {
        if (snap.type === MULTI_SAMPLE_VARIANT_DISPLAY) {
          if (snap.domain !== undefined) {
            throw new Error(
              'domain on a multi-sample variant display is rows: { "domain": [...] }, the row order beside the labels, tree and focus',
            )
          }
          if (snap.featureColor !== undefined) {
            throw new Error(
              'featureColor on a multi-sample variant display is color: a CSS colour or jexl callback, or { "field": "impact" | "svType" | "phaseSet" | <any record field> }',
            )
          }
        }
        return snap
      },
    },
  )
}

export type LinearMultiSampleVariantDisplayConfigModel = ReturnType<
  typeof configSchemaFactory
>
