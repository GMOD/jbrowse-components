import {
  AnyConfigurationSchemaType,
  ConfigurationReference,
} from '@jbrowse/core/configuration/configurationSchema'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
import { types } from 'mobx-state-tree'
import { BaseLinearDisplay } from '../BaseLinearDisplay'

export function stateModelFactory(configSchema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'LinearBareDisplay',
      BaseLinearDisplay,
      types.model({
        type: types.literal('LinearBareDisplay'),
        configuration: ConfigurationReference(configSchema),
      }),
    )

    .views(self => ({
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
