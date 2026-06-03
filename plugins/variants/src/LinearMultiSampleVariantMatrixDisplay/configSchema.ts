import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'

import { sharedVariantConfigSlots } from '../shared/SharedVariantConfigSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config LinearMultiSampleVariantMatrixDisplay
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
