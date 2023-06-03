import {
  AnyConfigurationSchemaType,
  ConfigurationReference,
} from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'
import { BaseLinearDisplay } from '@jbrowse/plugin-linear-genome-view'

export function stateModelFactory(configSchema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'LinearLollipopDisplay',
      BaseLinearDisplay,
      types.model({
        type: types.literal('LinearLollipopDisplay'),
        configuration: ConfigurationReference(configSchema),
      }),
    )

    .views(self => {
      const { renderProps: superRenderProps } = self
      return {
        get blockType() {
          return 'dynamicBlocks'
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
