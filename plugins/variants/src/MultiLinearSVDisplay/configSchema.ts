import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'

// locals
import sharedVariantConfigFactory from '../shared/SharedVariantConfigSchema'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config MultiLinearSVDisplay
 * extends
 * - [SharedSVDisplay](../sharedvariantdisplay)
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

export default function SVConfigFactory(pluginManager: PluginManager) {
  const MultiSVRendererConfigSchema =
    pluginManager.getRendererType('MultiSVRenderer')!.configSchema

  return ConfigurationSchema(
    'MultiLinearSVDisplay',
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
      renderers: ConfigurationSchema('RenderersConfiguration', {
        MultiSVRenderer: MultiSVRendererConfigSchema,
      }),

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
