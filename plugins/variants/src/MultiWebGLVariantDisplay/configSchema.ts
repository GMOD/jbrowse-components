import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import sharedVariantConfigFactory from '../shared/SharedVariantConfigSchema.ts'

/**
 * #config MultiWebGLVariantDisplay
 * extends
 * - [SharedVariantDisplay](../sharedvariantdisplay)
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

export default function configSchemaFactory() {
  return ConfigurationSchema(
    'MultiLinearVariantDisplay',
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
