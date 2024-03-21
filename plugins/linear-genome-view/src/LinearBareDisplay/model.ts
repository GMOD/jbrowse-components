import {
  AnyConfigurationSchemaType,
  ConfigurationReference,
} from '@jbrowse/core/configuration'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
import { types } from 'mobx-state-tree'
import { BaseLinearDisplay } from '../BaseLinearDisplay'

/**
 * #stateModel LinearBareDisplay
 * #category display
 * extends
 * - [BaseLinearDisplay](../baselineardisplay)
 */
export function stateModelFactory(configSchema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'LinearBareDisplay',
      BaseLinearDisplay,
      types.model({
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),

        /**
         * #property
         */
        type: types.literal('LinearBareDisplay'),
      }),
    )

    .views(self => {
      const { renderProps: superRenderProps } = self
      return {
        /**
         * #method
         */
        renderProps() {
          return {
            ...superRenderProps(),
            ...getParentRenderProps(self),
            config: self.configuration.renderer,
            rpcDriverName: self.rpcDriverName,
          }
        },

        /**
         * #getter
         */
        get rendererTypeName() {
          return self.configuration.renderer.type
        },
      }
    })
}
