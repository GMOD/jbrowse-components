import { types } from '@jbrowse/mobx-state-tree'
import { linearWebGLFeatureDisplayStateModelFactory } from '@jbrowse/plugin-canvas'

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel LinearVariantDisplay
 * GPU-accelerated variant display with custom feature widget on click.
 * extends
 *
 * - [LinearWebGLFeatureDisplay](../linearwebglfeaturedisplay)
 */
export default function stateModelFactory(
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'LinearVariantDisplay',
      linearWebGLFeatureDisplayStateModelFactory(configSchema),
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearVariantDisplay'),
      }),
    )
    .views(() => ({
      /**
       * #getter
       */
      get featureWidgetType() {
        return {
          type: 'VariantFeatureWidget',
          id: 'variantFeature',
        }
      },
    }))
}

export type LinearVariantDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearVariantDisplayModel = Instance<LinearVariantDisplayStateModel>
