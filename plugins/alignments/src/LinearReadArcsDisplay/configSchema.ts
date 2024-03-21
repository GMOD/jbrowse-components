import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { linearBasicDisplayConfigSchemaFactory } from '@jbrowse/plugin-linear-genome-view'
import { types } from 'mobx-state-tree'

/**
 * #config LinearReadArcsDisplay
 */
function configSchemaF(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearReadArcsDisplay',
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
      jitter: {
        defaultValue: 0,
        description:
          'jitters the x position so e.g. if many reads map to exact same x position, jittering makes it easy to see that there are many of them',
        type: 'number',
      },

      /**
       * #slot
       */
      lineWidth: {
        defaultValue: 1,
        description: 'set arc line width',
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
