import { ConfigurationSchema } from '@jbrowse/core/configuration'

import sharedVariantConfigFactory from '../shared/SharedVariantConfigSchema.ts'

/**
 * #config LinearMultiSampleVariantMatrixDisplay
 *
 * #example
 * Minimal `VariantTrack` config selecting the matrix display. The `displays`
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
 *       type: 'LinearMultiSampleVariantMatrixDisplay',
 *       displayId: 'cohort-LinearMultiSampleVariantMatrixDisplay',
 *     },
 *   ],
 * }
 * ```
 *
 * #example
 * Preloading sample metadata: point the adapter's `samplesTsvLocation` at a TSV
 * whose first column is the sample name and whose other columns are per-sample
 * attributes (e.g. `population`), then `colorBy` one of those attributes to
 * color the matrix rows on load (same metadata mechanism as the regular
 * `LinearMultiSampleVariantDisplay`):
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
 *       type: 'LinearMultiSampleVariantMatrixDisplay',
 *       displayId: 'cohort-LinearMultiSampleVariantMatrixDisplay',
 *       height: 400,
 *       colorBy: 'population',
 *     },
 *   ],
 * }
 * ```
 *
 * #example
 * Taller matrix filtering rare variants (MAF < 5 %), with pre-declared sample
 * colors and groups. `layout` seeds the initial row order, color, and group
 * labels inline instead of from a `samplesTsvLocation`:
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
 *       type: 'LinearMultiSampleVariantMatrixDisplay',
 *       displayId: 'cohort-LinearMultiSampleVariantMatrixDisplay',
 *       height: 400,
 *       minorAlleleFrequencyFilter: 0.05,
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

export default function configSchemaF() {
  return ConfigurationSchema(
    'LinearMultiSampleVariantMatrixDisplay',
    {
      /**
       * #slot
       */
      height: {
        type: 'number',
        defaultValue: 250,
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
