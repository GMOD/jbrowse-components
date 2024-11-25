import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { linearBasicDisplayConfigSchemaFactory } from '@jbrowse/plugin-linear-genome-view'
import type PluginManager from '@jbrowse/core/PluginManager'

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
      maxFeatureScreenDensity: {
        type: 'number',
        description: 'maximum features per pixel that is displayed in the view',
        defaultValue: 5,
      },

      /**
       * #slot
       */
      featureHeight: {
        type: 'number',
        defaultValue: 7,
      },

      /**
       * #slot
       */
      colorBy: {
        type: 'frozen',
        defaultValue: { type: 'insertSizeAndOrientation' },
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
