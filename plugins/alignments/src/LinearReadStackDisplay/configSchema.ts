import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { linearBasicDisplayConfigSchemaFactory } from '@jbrowse/plugin-linear-genome-view'

import { defaultFilterFlags } from '../shared/util'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config LinearReadStackDisplay
 */
function configSchemaF(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearReadStackDisplay',
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
        description: 'the default height of each feature in the display',
        defaultValue: 7,
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
