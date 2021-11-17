import PluginManager from '@jbrowse/core/PluginManager'
import { types } from 'mobx-state-tree'
import { ConfigurationSchema } from '@jbrowse/core/configuration'

export function configSchemaFactory(pluginManager: PluginManager) {
  const LGVPlugin = pluginManager.getPlugin(
    'LinearGenomeViewPlugin',
  ) as import('@jbrowse/plugin-linear-genome-view').default
  //@ts-ignore
  const { baseLinearDisplayConfigSchema } = LGVPlugin.exports
  return ConfigurationSchema(
    'LinearArcDisplay',
    {
      renderer: types.optional(
        pluginManager.pluggableConfigSchemaType('renderer'),
        { type: 'ArcRenderer' },
      ),
    },
    {
      baseConfiguration: baseLinearDisplayConfigSchema,
      explicitlyTyped: true,
    },
  )
}
