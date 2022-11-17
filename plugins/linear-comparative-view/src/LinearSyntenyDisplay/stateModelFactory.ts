import { types, Instance } from 'mobx-state-tree'
import {
  getConf,
  ConfigurationReference,
  AnyConfigurationSchemaType,
} from '@jbrowse/core/configuration'
import { getContainingView } from '@jbrowse/core/util'
import baseModelFactory from '../LinearComparativeDisplay/stateModelFactory'
import { LinearSyntenyViewModel } from '../LinearSyntenyView/model'

/**
 * #stateModel LinearSyntenyDisplay
 * extends `LinearComparativeDisplay` model
 */
function stateModelFactory(configSchema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'LinearSyntenyDisplay',
      baseModelFactory(configSchema),
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearSyntenyDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
      }),
    )

    .views(self => ({
      /**
       * #method
       */
      renderProps() {
        const parentView = getContainingView(self) as LinearSyntenyViewModel
        return {
          rpcDriverName: self.rpcDriverName,
          displayModel: self,
          config: getConf(self, 'renderer'),
          width: parentView.width,
          height: parentView.middleComparativeHeight,
        }
      },
      /**
       * #getter
       */
      get rendererTypeName() {
        return self.configuration.renderer.type
      },
      /**
       * #getter
       */
      get adapterConfig() {
        return {
          // @ts-ignore
          name: self.parentTrack.configuration.adapter.type,
          assemblyNames: getConf(self, 'assemblyNames'),
          ...getConf(self.parentTrack, 'adapter'),
        }
      },
      /**
       * #getter
       * unused
       */
      get trackIds() {
        return getConf(self, 'trackIds') as string[]
      },
    }))
}

export type LinearSyntenyDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearSyntenyDisplayModel = Instance<LinearSyntenyDisplayStateModel>

export default stateModelFactory
