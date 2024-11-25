import { ConfigurationReference } from '@jbrowse/core/configuration'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
import { types } from 'mobx-state-tree'
import { BaseLinearDisplay } from '../BaseLinearDisplay'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'

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
        type: types.literal('LinearBareDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
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
            rpcDriverName: self.rpcDriverName,
            config: self.configuration.renderer,
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
