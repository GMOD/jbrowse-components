import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'

import { sharedVariantConfigSlots } from '../shared/SharedVariantConfigSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config VariantMatrixDisplay
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

export default function configSchemaF(_pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearVariantMatrixDisplay',
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
