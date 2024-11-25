import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'
import { types } from 'mobx-state-tree'
import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config LinearArcDisplay
 */
export function configSchemaFactory(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearArcDisplay',
    {
      /**
       * #slot
       */
      renderer: types.optional(
        pluginManager.pluggableConfigSchemaType('renderer'),
        { type: 'ArcRenderer' },
      ),
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: baseLinearDisplayConfigSchema,
      explicitlyTyped: true,
    },
  )
}
