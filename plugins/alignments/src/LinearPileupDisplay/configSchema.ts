import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { linearBasicDisplayConfigSchemaFactory } from '@jbrowse/plugin-linear-genome-view'
import { types } from 'mobx-state-tree'
import { defaultFilterFlags } from '../shared/util'
import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config LinearPileupDisplay
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

function configSchemaF(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearPileupDisplay',
    {
      /**
       * #slot
       */
      defaultRendering: {
        type: 'stringEnum',
        model: types.enumeration('Rendering', ['pileup']),
        defaultValue: 'pileup',
      },
      /**
       * #slot
       */
      renderers: ConfigurationSchema('RenderersConfiguration', {
        PileupRenderer:
          pluginManager.getRendererType('PileupRenderer')!.configSchema,
      }),
      /**
       * #slot
       */
      maxFeatureScreenDensity: {
        type: 'number',
        description: 'maximum features per pixel that is displayed in the view',
        defaultValue: 5,
      },

      /**
       * #slot
       */
      colorBy: {
        type: 'frozen',
        description: 'color scheme to use',
        defaultValue: {
          type: 'normal',
        },
      },

      /**
       * #slot
       */
      filterBy: {
        type: 'frozen',
        description: 'default filters to use',
        defaultValue: defaultFilterFlags,
      },
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: linearBasicDisplayConfigSchemaFactory(pluginManager),
      explicitlyTyped: true,
    },
  )
}

export default configSchemaF
