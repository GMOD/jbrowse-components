import { ConfigurationSchema } from '@jbrowse/core/configuration'
import baseLinearDisplayConfigSchema from '@jbrowse/display-kit/configSchema'
import { facetConfigSchema } from '@jbrowse/display-kit/facetConfigSchema'
import { fieldPredicateList } from '@jbrowse/display-kit/fieldPredicateConfigSchema'
import { heightModeConfigSchemaFields } from '@jbrowse/display-kit/heightModeConfigSchemaFields'
import { legendConfigSchema } from '@jbrowse/display-kit/legendConfigSchema'
import { rowColorConfigSchema } from '@jbrowse/display-kit/rowColorConfigSchema'
import { sampleRowsConfigSchema } from '@jbrowse/display-kit/sampleRowsConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'
import { rowAxisWithGridConfigSchema } from '@jbrowse/tree-sidebar/rowAxisWithGridConfigSchema'
import { rowHeightConfigSchemaFields } from '@jbrowse/tree-sidebar/rowHeightConfigSchemaFields'

import {
  MULTI_SAMPLE_VARIANT_DISPLAY,
  VARIANT_UNITS,
} from '../shared/constants.ts'
import { cellEncodingConfigSchema } from './cellEncodingConfigSchema.ts'
import { recordsBandConfigSchema } from './recordsBandConfigSchema.ts'

/**
 * #config LinearMultiSampleVariantDisplay
 * Draws the genotypes in a multi-sample `VariantTrack`, one row per sample or
 * per phased haplotype.
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
 *       unit: 'haplotype',
 *       rows: { sort: ['HG002'] },
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
      /**
       * #slot filter
       * The variants the display draws, a list of
       * [](/docs/config/fieldpredicate) entries a site must all pass: a field
       * of the record's own, a `jexl:` expression that must hold,
       * `minorAlleleFrequency`, the share of its called alleles the second
       * most frequent one makes up, and `missingness`, the share of its
       * alleles uncalled. `[{ field: "minorAlleleFrequency", gte: 0.05 }]`
       * drops the rare variants; a site with no called allele draws nothing
       * whatever the list says.
       */
      filter: fieldPredicateList(),
      ...rowHeightConfigSchemaFields(),
      /**
       * #slot axis
       * The guide down the left of the sample rows: the clustering tree, each
       * sample's name and the lines between rows.
       */
      axis: rowAxisWithGridConfigSchema,
      /**
       * #slot rows
       * The rows are the file's samples, and the object is the arrangement a
       * reader gives them, each member by row name: a sample in allele-count
       * mode, a haplotype (`"<sample> HP<n>"`) in phased mode, where a sample
       * name stands for all of its haplotypes. The samples `sort` lists come
       * first and the rest keep the file's order; a facet groups within it.
       * Written whole, as every display's `rows` is.
       */
      rows: sampleRowsConfigSchema,
      /**
       * #slot tooltip
       * The hover tooltip naming the genotype, the sample and the record
       * under the pointer. Off, the crosshairs, the highlighted cell and the
       * cross-display `session.hovered` channel stay.
       */
      tooltip: ConfigurationSchema(
        'SampleTooltip',
        {
          /**
           * #slot tooltip.show
           */
          show: {
            type: 'boolean',
            defaultValue: true,
            description:
              'show the hover tooltip over the genotype rows; the crosshairs and the hover highlight stay either way',
          },
        },
        { closed: true },
      ),
      /**
       * #slot
       */
      unit: {
        type: 'stringEnum',
        model: types.enumeration('VariantUnit', [...VARIANT_UNITS]),
        defaultValue: 'sample',
        description:
          "The unit one row draws: 'sample' colors each row by allele dosage, 'haplotype' draws one row per phased haplotype",
        plot: true,
      },
      /**
       * #slot encoding
       * The genotype cells' channels: `encoding.color`, the hue of every cell
       * with an alt allele.
       */
      encoding: cellEncodingConfigSchema,
      /**
       * #slot
       * Compose the cell hue with the genotype's alt dosage — the fraction of
       * its called alleles that are non-reference — so a homozygote paints the
       * hue itself and a heterozygote a lighter version of it. Off paints each
       * alt cell its flat hue.
       */
      shadeByDosage: {
        type: 'boolean',
        defaultValue: true,
        description:
          "shade each alt cell by the fraction of its called alleles that are non-reference, so a homozygote is darker than a heterozygote; off paints every alt cell the mode's flat hue",
      },
      /**
       * #slot legend
       * The floating key over the display. It is clipped to the display's own
       * bounds, so turn it off to size a short display to its rows rather
       * than to its key.
       */
      legend: legendConfigSchema,
      /**
       * #slot rowColor
       * The bar beside each row's label: a sample-metadata attribute whose
       * palette colors every row, or under `name` the colors a reader set row
       * by row.
       */
      rowColor: rowColorConfigSchema,
      /**
       * #slot facet
       * A sample-metadata attribute (a column in the adapter's
       * samplesTsvLocation, e.g. `"population"`) whose values each take a
       * band of rows; or `{ field, sort }`, the listed values banding
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
          "reference-allele drawing: 'skip' (the default) fills the row background solid grey and paints only ALT alleles, which makes overlapping variants easier to pick out; 'draw' paints reference alleles like any other genotype",
      },
      /**
       * #slot records
       * The structural variants above the genotype rows, stacked as a
       * `LinearVariantDisplay` stacks them and colored by SV type:
       * `show` (default off), `maxHeight`, the most it takes from the
       * rows, and `labels`.
       */
      records: recordsBandConfigSchema,
      /**
       * #slot genotypes
       * The genotype rows. Off, the display reads no genotypes and draws as
       * it does for a VCF with no samples: the records alone, every one the
       * filter admits, sized by `heightMode`.
       */
      genotypes: ConfigurationSchema(
        'GenotypeRows',
        {
          /**
           * #slot genotypes.show
           */
          show: {
            type: 'boolean',
            defaultValue: true,
            description:
              'draw a row per sample; off, the display draws the records alone, as for a VCF with no samples',
          },
        },
        { closed: true },
      ),
      ...heightModeConfigSchemaFields({
        defaultHeightMode: 'fit',
        heightMode:
          'Track-sizing strategy while no genotype rows draw (no samples, or `genotypes.show` off), as on a feature track: `fit` keeps the track height and gives up labels, then squeezes the records; `fixed` keeps the track height at full record size; `grow` sizes the track to its records up to `growMaxHeight`. With genotype rows the track keeps its `height`',
        growMaxHeight: "Ceiling in pixels for `heightMode: 'grow'`",
      }),
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: baseLinearDisplayConfigSchema,
      explicitlyTyped: true,
      // v4's two multi-sample displays spelt the sidebar's tree and labels and
      // the reference-allele paint as booleans, named the row color's
      // attribute `colorBy`, and carried the wiggle scale slots the matrix
      // never read.
      retired: {
        renderingMode: (v: unknown) => ({
          unit: v === 'phased' ? 'haplotype' : 'sample',
        }),
        showSidebarLabels: (labels: unknown) => ({ axis: { labels } }),
        showTree: (tree: unknown) => ({ axis: { tree } }),
        showReferenceAlleles: (draw: unknown) => ({
          referenceDrawingMode: draw ? 'draw' : 'skip',
        }),
        colorBy: (field: unknown) =>
          typeof field === 'string' && field ? { rowColor: field } : {},
        autoscale: () => ({}),
        minScore: () => ({}),
        maxScore: () => ({}),
        scaleType: () => ({}),
        inverted: () => ({}),
        numStdDev: () => ({}),
        minimalTicks: () => ({}),
      },
      preProcessSnapshot: liftMinorAlleleFrequencyFilter,
    },
  )
}

// v4's `minorAlleleFrequencyFilter`, a floor beside its `jexlFilters`: read
// here rather than in `retired`, where two lifts into one `filter` list would
// keep the first and drop the other
function liftMinorAlleleFrequencyFilter(snapshot: Record<string, unknown>) {
  const { minorAlleleFrequencyFilter, ...rest } = snapshot
  if (minorAlleleFrequencyFilter === undefined) {
    return snapshot
  }
  return typeof minorAlleleFrequencyFilter === 'number' &&
    minorAlleleFrequencyFilter > 0
    ? {
        ...rest,
        filter: [
          ...(Array.isArray(rest.filter) ? rest.filter : []),
          { field: 'minorAlleleFrequency', gte: minorAlleleFrequencyFilter },
        ],
      }
    : rest
}

export type LinearMultiSampleVariantDisplayConfigModel = ReturnType<
  typeof configSchemaFactory
>
