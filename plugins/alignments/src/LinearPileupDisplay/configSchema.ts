import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { linearBasicDisplayConfigSchemaFactory } from '@jbrowse/plugin-linear-genome-view'
import { types } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config LinearPileupDisplay
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

function configSchemaF(pluginManager: PluginManager) {
  // modify config schema to take in a sub coverage display
  return ConfigurationSchema(
    'LinearPileupDisplay',
    {
      /**
       * #slot
       */
      colorScheme: {
        defaultValue: 'normal',
        description: 'color scheme to use',
        model: types.enumeration('colorScheme', [
          'strand',
          'normal',
          'insertSize',
          'insertSizeAndOrientation',
          'mappingQuality',
          'tag',
        ]),
        type: 'stringEnum',
      },

      /**
       * #slot
       */
      defaultRendering: {
        defaultValue: 'pileup',
        model: types.enumeration('Rendering', ['pileup']),
        type: 'stringEnum',
      },

      /**
       * #slot
       */
      maxFeatureScreenDensity: {
        defaultValue: 5,
        description: 'maximum features per pixel that is displayed in the view',
        type: 'number',
      },

      /**
       * #slot
       */
      renderers: ConfigurationSchema('RenderersConfiguration', {
        PileupRenderer:
          pluginManager.getRendererType('PileupRenderer').configSchema,
      }),
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
