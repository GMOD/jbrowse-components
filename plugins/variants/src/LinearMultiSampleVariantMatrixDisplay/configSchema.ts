import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'

import { sharedVariantConfigSlots } from '../shared/SharedVariantConfigSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config LinearMultiSampleVariantMatrixDisplay
 *
 * #example
 * A complete `VariantTrack` config to paste into `tracks`, laying samples out
 * as a matrix (columns = features, rows = samples) instead of stacked rows.
 * `minorAlleleFrequencyFilter` hides common variants below the given MAF:
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
