import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { linearBasicDisplayConfigSchemaFactory } from '@jbrowse/plugin-linear-genome-view'

import { defaultFilterFlags } from '../shared/util'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config LinearReadCloudDisplay
 */
function configSchemaF(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearReadCloudDisplay',
    {
      minSubfeatureWidth: {
        type: 'number',
        defaultValue: 1,
      },

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
      hideSmallIndels: {
        type: 'boolean',
        defaultValue: false,
      },

      /**
       * #slot
       */
      hideMismatches: {
        type: 'boolean',
        defaultValue: false,
      },

      /**
       * #slot
       */
      hideLargeIndels: {
        type: 'boolean',
        defaultValue: false,
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
