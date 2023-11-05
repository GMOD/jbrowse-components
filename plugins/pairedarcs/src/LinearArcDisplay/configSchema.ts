import PluginManager from '@jbrowse/core/PluginManager'
import { types } from 'mobx-state-tree'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'

/**
 * #config LinearArcDisplay
 */
export function configSchemaFactory(
  pluginManager: PluginManager,
  name: string,
) {
  return ConfigurationSchema(
    name,
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
