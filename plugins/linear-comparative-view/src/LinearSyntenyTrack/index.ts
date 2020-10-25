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
} from '../LinearComparativeTrack'
import { LinearSyntenyViewModel } from '../LinearSyntenyView/model'

export function configSchemaFactory(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearSyntenyTrack',
    {
      viewType: 'LinearSyntenyView',
      trackIds: {
        type: 'stringArray',
        defaultValue: [],
      },
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),
      renderer: pluginManager.pluggableConfigSchemaType('renderer'),
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
      'LinearSyntenyTrack',
      baseModelFactory(configSchema),
      types.model('LinearSyntenyTrack', {
        type: types.literal('LinearSyntenyTrack'),
        configuration: ConfigurationReference(configSchema),
      }),
    )

    .views(self => ({
      get highResolutionScaling() {
        return 1
      },
      get renderProps() {
        const parentView = getContainingView(self) as LinearSyntenyViewModel
        return {
          trackModel: self,
          config: getConf(self, 'renderer'),
          width: parentView.width,
          height: 100,
        }
      },
      get rendererTypeName() {
        return self.configuration.renderer.type
      },
      get adapterConfig() {
        // TODO possibly enriches with the adapters from associated trackIds
        return {
          name: self.configuration.adapter.type,
          assemblyNames: getConf(self, 'assemblyNames'),
          ...getConf(self, 'adapter'),
        }
      },

      get trackIds() {
        return getConf(self, 'trackIds') as string[]
      },
    }))
}

export type LinearSyntenyTrackStateModel = ReturnType<typeof stateModelFactory>
export type LinearSyntenyTrackModel = Instance<LinearSyntenyTrackStateModel>
