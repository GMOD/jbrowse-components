import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { linearBasicDisplayConfigSchemaFactory } from '@jbrowse/plugin-linear-genome-view'
import { types } from 'mobx-state-tree'

/**
 * #config LinearReadCloudDisplay
 */
function configSchemaF(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearReadCloudDisplay',
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
      featureHeight: {
        defaultValue: 7,
        type: 'number',
      },

      /**
       * #slot
       */
      maxFeatureScreenDensity: {
        defaultValue: 5,
        description: 'maximum features per pixel that is displayed in the view',
        type: 'number',
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
