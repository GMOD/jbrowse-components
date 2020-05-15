import {
  ConfigurationReference,
  ConfigurationSchema,
  getConf,
} from '@gmod/jbrowse-core/configuration'
import { getParentRenderProps } from '@gmod/jbrowse-core/util/tracks'
import { types } from 'mobx-state-tree'
import { AnyConfigurationSchemaType } from '@gmod/jbrowse-core/configuration/configurationSchema'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import { getSession } from '@gmod/jbrowse-core/util'
import { BaseTrackConfig } from './baseTrackModel'
import BlockBasedTrackComponent from './components/BlockBasedTrack'
import blockBasedTrack from './blockBasedTrackModel'

export function configSchemaFactory(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'BasicTrack',
    {
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),
      renderer: pluginManager.pluggableConfigSchemaType('renderer'),
    },
    {
      baseConfiguration: BaseTrackConfig,
      explicitlyTyped: true,
    },
  )
}

export function stateModelFactory(configSchema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'BasicTrack',
      blockBasedTrack,
      types.model({
        type: types.literal('BasicTrack'),
        configuration: ConfigurationReference(configSchema),
        height: 100,
      }),
    )

    .views(self => ({
      get renderProps() {
        return {
          ...self.composedRenderProps,
          ...getParentRenderProps(self),
          config: self.configuration.renderer,
          refNameMapsForAdapter: new Map(
            (getConf(self, 'assemblyNames') as string[]).map(assemblyName => {
              return [
                assemblyName,
                getSession(self).assemblyManager.getRefNameMapForAdapter(
                  getConf(self, 'adapter'),
                  assemblyName,
                ),
              ]
            }),
          ),
        }
      },

      get rendererTypeName() {
        return self.configuration.renderer.type
      },
    }))
    .volatile(() => ({
      ReactComponent: BlockBasedTrackComponent,
    }))
}

export type BasicTrackStateModel = ReturnType<typeof stateModelFactory>
