import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'

import baseConfigFactory from '../LinearComparativeDisplay/configSchemaF'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config LinearSyntenyDisplay
 */
function configSchemaFactory(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearSyntenyDisplay',
    {
      /**
       * #slot
       * currently unused
       */
      trackIds: {
        type: 'stringArray',
        defaultValue: [],
      },

      /**
       * #slot
       * Allows custom colours to be defined based on a tag found in the PAF file.
       * For example, if tag is "cl" and mapping is { "ortho": "black", "homol": "green" },
       * then features with "cl:Z:ortho" will be black, "cl:Z:homol" will be green,
       * and any other "cl" value or features without a "cl" tag will use the default.
       */
      colorByTag: types.maybe(
        ConfigurationSchema(
          'ColorByTag',
          {
            tag: {
              type: 'string',
              defaultValue: 'cl',
              description: 'The tag to use for colour mapping (e.g., "cl")',
            },
            mapping: {
              type: 'frozen',
              defaultValue: {},
              description: 'An object mapping tag values to colours',
            },
            default: {
              type: 'color',
              defaultValue: 'blue',
              description: 'The default colour if the tag value is not found in the mapping',
            },
          },
          { explicitlyTyped: true },
        ),
      ),

      /**
       * #slot
       * currently unused
       */
      middle: {
        type: 'boolean',
        defaultValue: true,
      },
    },
    {
      /**
       * #baseConfiguration
       * this refers to the LinearComparativeDisplay
       */
      baseConfiguration: baseConfigFactory(pluginManager),
      explicitlyTyped: true,
    },
  )
}

export default configSchemaFactory
