import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { linearBasicDisplayConfigSchemaFactory } from '@jbrowse/plugin-linear-genome-view'
import { types, Instance } from 'mobx-state-tree'
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
          pluginManager.getRendererType('PileupRenderer').configSchema,
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
      colorScheme: {
        type: 'stringEnum',
        model: types.enumeration('colorScheme', [
          'strand',
          'normal',
          'insertSize',
          'insertSizeAndOrientation',
          'mappingQuality',
          'tag',
        ]),
        description: 'color scheme to use',
        defaultValue: 'normal',
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

export type LinearPileupDisplayConfigModel = ReturnType<typeof configSchemaF>
export type LinearPileupDisplayConfig = Instance<LinearPileupDisplayConfigModel>
export default configSchemaF
