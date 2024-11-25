import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { linearBasicDisplayConfigSchemaFactory } from '@jbrowse/plugin-linear-genome-view'
import { defaultFilterFlags } from '../shared/util'
import type PluginManager from '@jbrowse/core/PluginManager'

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
      maxFeatureScreenDensity: {
        type: 'number',
        description: 'maximum features per pixel that is displayed in the view',
        defaultValue: 5,
      },

      /**
       * #slot
       */
      lineWidth: {
        type: 'number',
        description: 'set arc line width',
        defaultValue: 1,
      },

      /**
       * #slot
       */
      jitter: {
        type: 'number',
        description:
          'jitters the x position so e.g. if many reads map to exact same x position, jittering makes it easy to see that there are many of them',
        defaultValue: 0,
      },

      /**
       * #slot
       */
      colorBy: {
        type: 'frozen',
        defaultValue: { type: 'insertSizeAndOrientation' },
      },
      /**
       * #slot
       */
      filterBy: {
        type: 'frozen',
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
