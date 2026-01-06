import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import sharedVariantConfigFactory from '../shared/SharedVariantConfigSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config MultiLinearVariantDisplay
 * extends
 * - [SharedVariantDisplay](../sharedvariantdisplay)
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

export default function VariantConfigFactory(pluginManager: PluginManager) {
  const MultiVariantRendererConfigSchema = pluginManager.getRendererType(
    'MultiVariantRenderer',
  )!.configSchema

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
      renderers: ConfigurationSchema('RenderersConfiguration', {
        MultiVariantRenderer: MultiVariantRendererConfigSchema,
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
