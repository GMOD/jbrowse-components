import PluginManager from '@jbrowse/core/PluginManager'
import { types } from 'mobx-state-tree'
import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config LinearArcDisplay
 */
export function configSchemaFactory(pluginManager: PluginManager) {
  const LGVPlugin = pluginManager.getPlugin(
    'LinearGenomeViewPlugin',
  ) as import('@jbrowse/plugin-linear-genome-view').default
  const { baseLinearDisplayConfigSchema } = LGVPlugin.exports
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
