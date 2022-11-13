import {
  getConf,
  AnyConfigurationSchemaType,
} from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import { types } from 'mobx-state-tree'

export default function stateModelFactory(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  const WigglePlugin = pluginManager.getPlugin(
    'WigglePlugin',
  ) as import('@jbrowse/plugin-wiggle').default
  const { linearWiggleDisplayModelFactory } = WigglePlugin.exports
  return types
    .compose(
      'LinearGCContentDisplay',
      linearWiggleDisplayModelFactory(pluginManager, configSchema),
      types.model({
        type: types.literal('LinearGCContentDisplay'),
      }),
    )
    .views(self => {
      const { renderProps: superRenderProps } = self
      return {
        renderProps() {
          const sequenceAdapter = getConf(self.parentTrack, 'adapter')
          return {
            ...superRenderProps(),
            adapterConfig: {
              type: 'GCContentAdapter',
              sequenceAdapter,
            },
          }
        },
      }
    })
}
