import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { getEnv, getSession, isSelectionContainer } from '@jbrowse/core/util'
import { BaseLinearDisplay } from '@jbrowse/plugin-linear-genome-view'
import { types } from '@jbrowse/mobx-state-tree'

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'

/**
 * #stateModel SharedVariantMixin
 */
export default function SharedVariantMixin(
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      BaseLinearDisplay,
      types.model({
        /**
         * #property
         */
        selectedRendering: types.optional(types.string, ''),
        /**
         * #property
         */
        summaryScoreMode: types.maybe(types.string),
        /**
         * #property
         */
        rendererTypeNameState: types.maybe(types.string),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       */
      message: undefined as undefined | string,
    }))
    .actions(self => ({
      /**
       * #action
       * this overrides the BaseLinearDisplayModel to avoid popping up a
       * feature detail display, but still sets the feature selection on the
       * model so listeners can detect a click
       */
      selectFeature(feature: Feature) {
        const session = getSession(self)
        if (isSelectionContainer(session)) {
          session.setSelection(feature)
        }
      },

      /**
       * #action
       */
      setRendererType(val: string) {
        self.rendererTypeNameState = val
      },
    }))

    .views(self => ({
      /**
       * #getter
       */
      get adapterTypeName() {
        return self.adapterConfig.type
      },

      /**
       * #getter
       */
      get rendererTypeNameSimple() {
        return self.rendererTypeNameState ?? getConf(self, 'defaultRendering')
      },

      /**
       * #getter
       * subclasses can define these, as snpcoverage track does
       */
      get filters() {
        return undefined
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get adapterCapabilities() {
        const type = self.adapterTypeName
        const { pluginManager } = getEnv(self)
        return pluginManager.getAdapterType(type)!.adapterCapabilities
      },
    }))
    .actions(self => {
      const { reload: superReload } = self
      return {
        /**
         * #action
         */
        async reload() {
          self.setError()
          superReload()
        },
      }
    })
}
