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
 *       height: 400,
 *       colorBy: 'population',
 *     },
 *   ],
 * }
 * ```
 *
 * #example
 * Taller matrix filtering rare variants (MAF < 5 %). Row order, per-row color
 * and group labels come from the adapter's `samplesTsvLocation` above — the
 * display's own `layout` holds the arrangement the user then drags into place,
 * so it is session state rather than a config slot:
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
 *       height: 400,
 *       minorAlleleFrequencyFilter: 0.05,
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
        description:
          'Starting height in pixels for the whole display, including the lineZoneHeight band above the rows; drag-resizable, and the rows divide what is left over while row height is on auto-fit',
      },
      /**
       * #slot
       * Raises the shared slot's 0 default: this display lays columns out by
       * feature index, so it needs the zone for the lines tying each column
       * back to its genomic position. Drag-resizable, like `height`.
       */
      lineZoneHeight: {
        type: 'number',
        defaultValue: 20,
        advanced: true,
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
