import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'

import { sharedVariantConfigSlots } from '../shared/SharedVariantConfigSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

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
 * Taller matrix filtering rare variants (MAF < 5 %), with pre-declared sample
 * colors and groups. `layout` seeds the initial row order, color, and group
 * labels:
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

export default function configSchemaF(_pluginManager: PluginManager) {
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

      /**
       * #slot
       */
      ...sharedVariantConfigSlots,
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: baseLinearDisplayConfigSchema,
      explicitlyTyped: true,
    },
  )
}
