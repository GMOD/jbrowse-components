import { types, Instance } from 'mobx-state-tree'
import {
  getConf,
  ConfigurationReference,
  ConfigurationSchema,
} from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import { getContainingView } from '@jbrowse/core/util'
import {
  configSchemaFactory as baseConfigFactory,
  stateModelFactory as baseModelFactory,
} from '../LinearComparativeDisplay'
import { LinearSyntenyViewModel } from '../LinearSyntenyView/model'

export function configSchemaFactory(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearSyntenyDisplay',
    {
      trackIds: {
        type: 'stringArray',
        defaultValue: [],
      },
      renderer: types.optional(
        pluginManager.pluggableConfigSchemaType('renderer'),
        { type: 'LinearSyntenyRenderer' },
      ),
      middle: { type: 'boolean', defaultValue: true },
    },
    {
      baseConfiguration: baseConfigFactory(pluginManager),
      explicitlyTyped: true,
    },
  )
}

export function stateModelFactory(
  configSchema: ReturnType<typeof configSchemaFactory>,
) {
  return types
    .compose(
      'LinearSyntenyDisplay',
      baseModelFactory(configSchema),
      types.model({
        type: types.literal('LinearSyntenyDisplay'),
        configuration: ConfigurationReference(configSchema),
      }),
    )

    .views(self => ({
      renderProps() {
        const parentView = getContainingView(self) as LinearSyntenyViewModel
        return {
          rpcDriverName: self.rpcDriverName,
          displayModel: self,
          config: getConf(self, 'renderer'),
          width: parentView.width,
          height: parentView.middleComparativeHeight,
          highResolutionScaling: 2,
        }
      },
      get rendererTypeName() {
        return self.configuration.renderer.type
      },
      get adapterConfig() {
        // TODO possibly enriches with the adapters from associated trackIds
        return {
          name: self.parentTrack.configuration.adapter.type,
          assemblyNames: getConf(self, 'assemblyNames'),
          ...getConf(self.parentTrack, 'adapter'),
        }
      },

      get trackIds() {
        return getConf(self, 'trackIds') as string[]
      },
    }))
}

export type LinearSyntenyDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearSyntenyDisplayModel = Instance<LinearSyntenyDisplayStateModel>
