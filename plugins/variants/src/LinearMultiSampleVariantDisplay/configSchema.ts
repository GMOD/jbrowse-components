import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import sharedVariantConfigFactory from '../shared/SharedVariantConfigSchema.ts'

/**
 * #config LinearMultiSampleVariantDisplay
 * extends
 * - [SharedVariantDisplay](../sharedvariantdisplay)
 */

export default function configSchemaFactory() {
  return ConfigurationSchema(
    'LinearMultiSampleVariantDisplay',
    {
      /**
       * #slot
       */
      defaultRendering: {
        type: 'stringEnum',
        model: types.enumeration('Rendering', ['multivariant']),
        defaultValue: 'multivariant',
      },

      /**
       * #slot
       */
      height: {
        type: 'number',
        defaultValue: 200,
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
