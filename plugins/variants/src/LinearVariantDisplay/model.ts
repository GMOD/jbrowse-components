import { types } from '@jbrowse/mobx-state-tree'
import { linearFeatureDisplayStateModelFactory } from '@jbrowse/plugin-canvas'

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel LinearVariantDisplay
 * GPU-accelerated variant display with custom feature widget on click.
 * extends
 *
 * - [LinearFeatureDisplay](../linearfeaturedisplay)
 */
export default function stateModelFactory(
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'LinearVariantDisplay',
      linearFeatureDisplayStateModelFactory(configSchema),
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
