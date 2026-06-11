import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { BaseLinearDisplay } from '../BaseLinearDisplay/index.ts'

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'

/**
 * #stateModel LinearBareDisplay
 * #category display
 *
 * Legacy block-stack display for `BasicTrack`: `BaseLinearDisplay` plus a
 * pluggable `renderer` slot. Not commonly used; the GPU `LinearBasicDisplay`
 * is the default feature display. See agent-docs/ARCHITECTURE.md "Display stacks".
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
    .views(self => ({
      /**
       * #getter
       */
      get rendererConfig() {
        return getConf(self, ['renderer'])
      },
      /**
       * #getter
       */
      get rendererTypeName() {
        return getConf(self, ['renderer', 'type'])
      },
    }))
    .views(self => {
      const { renderProps: superRenderProps } = self
      return {
        /**
         * #method
         */
        renderProps() {
          return {
            ...superRenderProps(),
            config: self.rendererConfig,
          }
        },
      }
    })
}
