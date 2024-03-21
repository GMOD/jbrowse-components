import {
  AnyConfigurationSchemaType,
  ConfigurationReference,
} from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'
import { BaseLinearDisplay } from '@jbrowse/plugin-linear-genome-view'

/**
 * #stateModel LinearLollipopDisplay
 * extends
 * - [BaseLinearDisplay](../baselineardisplay)
 */
export function stateModelFactory(configSchema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'LinearLollipopDisplay',
      BaseLinearDisplay,
      types.model({
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),

        /**
         * #property
         */
        type: types.literal('LinearLollipopDisplay'),
      }),
    )

    .views(self => {
      const { renderProps: superRenderProps } = self
      return {
        /**
         * #getter
         */
        get blockType() {
          return 'dynamicBlocks'
        },
        /**
         * #getter
         */
        get renderDelay() {
          return 500
        },
        /**
         * #method
         */
        renderProps() {
          return {
            ...superRenderProps(),
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
