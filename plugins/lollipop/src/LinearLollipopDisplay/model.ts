import {
  AnyConfigurationSchemaType,
  ConfigurationReference,
} from '@jbrowse/core/configuration/configurationSchema'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
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

    .views(self => ({
      get blockType() {
        return 'dynamicBlocks'
      },
      get renderDelay() {
        return 500
      },
      get renderProps() {
        return {
          ...self.composedRenderProps,
          ...getParentRenderProps(self),
          rpcDriverName: self.rpcDriverName,
          config: self.configuration.renderer,
        }
      },
      get rendererTypeName() {
        return self.configuration.renderer.type
      },
    }))
}
