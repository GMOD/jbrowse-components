import { ConfigurationSchema } from '@jbrowse/core/configuration'

import sharedVariantConfigFactory from '../shared/SharedVariantConfigSchema.ts'

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
 * attributes (e.g. `population`), then `colorBy` one of those attributes to
 * color the sidebar rows on load. `showReferenceAlleles: false` paints the
 * background solid grey and draws only ALT alleles on top, which makes
 * overlapping structural variants easier to see. This is the 1000 Genomes
 * "colored by population" demo config:
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
 *       colorBy: 'population',
 *       showReferenceAlleles: false,
 *     },
 *   ],
 * }
 * ```
 *
 * #example
 * Taller track, phased haplotype rows, with pre-declared sample colors and
 * groups. `layout` seeds the initial sample order, color, and group labels
 * (used for sidebar coloring) inline instead of from a `samplesTsvLocation`:
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
 *       layout: [
 *         { name: 'HG001', color: '#e41a1c', group: 'case' },
 *         { name: 'HG002', color: '#377eb8', group: 'control' },
 *         { name: 'HG003', color: '#4daf4a', group: 'control' },
 *       ],
 *     },
 *   ],
 * }
 * ```
 */

export default function configSchemaFactory() {
  return ConfigurationSchema(
    'LinearMultiSampleVariantDisplay',
    {
      /**
       * #slot
       */
      height: {
        type: 'number',
        defaultValue: 200,
      },
      /**
       * #slot
       * Widen each alt-carrying cell of an insertion to a marker sized by the
       * inserted bp, the same one `plugins/alignments` and `plugins/maf` draw,
       * with the bp count when the row is tall enough.
       *
       * A cell is drawn across the reference the record covers, with a 2px floor.
       * That is right for a SNP and right for a deletion, but an insertion
       * consumes almost no reference, so a 65 kb insertion and a SNP both land on
       * that floor and the structural tier of a pangenome callset becomes
       * unreadable. Only cells whose genotype carries the allele widen, and each
       * keeps its genotype color, so the marker adds length without displacing
       * what the color already says.
       *
       * This display only: it draws every cell at its genomic position, so a
       * width there is a claim about length.
       * `LinearMultiSampleVariantMatrixDisplay` lays its columns out by feature
       * index at a uniform width, so it has no such width to correct.
       */
      showInsertionGlyphs: {
        type: 'boolean',
        defaultValue: true,
        description:
          'widen insertion cells to a marker sized by the inserted bp, instead of drawing them at the 2px floor like a SNP',
      },
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: sharedVariantConfigFactory(),
      explicitlyTyped: true,
    },
  )
}

export type LinearMultiSampleVariantDisplayConfigModel = ReturnType<
  typeof configSchemaFactory
>
