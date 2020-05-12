import { types, Instance, getParent } from 'mobx-state-tree'
import {
  getConf,
  ConfigurationReference,
  ConfigurationSchema,
} from '@gmod/jbrowse-core/configuration'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import {
  configSchemaFactory as baseConfigFactory,
  stateModelFactory as baseModelFactory,
} from '../LinearComparativeTrack'

interface Block {
  start: number
  end: number
  refName: string
  assemblyName: string
  key: string
}

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
  pluginManager: PluginManager,
  configSchema: ReturnType<typeof configSchemaFactory>,
) {
  return types
    .compose(
      'LinearSyntenyTrack',
      baseModelFactory(pluginManager, configSchema),
      types.model('LinearSyntenyTrack', {
        type: types.literal('LinearSyntenyTrack'),
        configuration: ConfigurationReference(configSchema),
      }),
    )

    .views(self => ({
      // see link, can't have colliding name `width` so renamed to `effectiveWidth`
      // https://spectrum.chat/mobx-state-tree/general/types-compose-error~484a5bbe-a280-4fae-8ba7-eb14afc1257d
      get effectiveWidth() {
        return getParent(self, 2).width
      },
      get effectiveHeight() {
        return 100
      },
      get highResolutionScaling() {
        return 1
      },
      get renderProps() {
        return {
          trackModel: self,
          config: getConf(self, 'renderer'),
          height: this.effectiveHeight,
          width: this.effectiveWidth,
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

type SyntenyTrackModel = ReturnType<typeof stateModelFactory>
type SyntenyTrack = Instance<SyntenyTrackModel>

export type LinearSyntenyTrackStateModel = ReturnType<typeof stateModelFactory>
