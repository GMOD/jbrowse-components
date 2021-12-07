import {
  AnyConfigurationSchemaType,
  ConfigurationReference,
} from '@jbrowse/core/configuration/configurationSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import { types } from 'mobx-state-tree'

export function stateModelFactory(
  configSchema: AnyConfigurationSchemaType,
  pluginManager: PluginManager,
) {
  const LGVPlugin = pluginManager.getPlugin(
    'LinearGenomeViewPlugin',
  ) as import('@jbrowse/plugin-linear-genome-view').default
  // @ts-ignore
  const { BaseLinearDisplay } = LGVPlugin.exports
  return types
    .compose(
      'LinearArcDisplay',
      BaseLinearDisplay,
      types.model({
        type: types.literal('LinearArcDisplay'),
        configuration: ConfigurationReference(configSchema),
      }),
    )

    .views(self => {
      const { renderProps: superRenderProps } = self
      return {
        get blockType() {
          return 'staticBlocks'
        },
        get renderDelay() {
          return 500
        },
        renderProps() {
          return {
            ...superRenderProps(),
            rpcDriverName: self.rpcDriverName,
            config: self.configuration.renderer,
          }
        },
        get rendererTypeName() {
          return self.configuration.renderer.type
        },
      }
    })
}
