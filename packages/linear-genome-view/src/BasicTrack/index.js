import {
  ConfigurationReference,
  ConfigurationSchema,
} from '@gmod/jbrowse-core/configuration'
import { getParentRenderProps } from '@gmod/jbrowse-core/util/tracks'
import { types } from 'mobx-state-tree'
import { BaseTrackConfig } from './baseTrackModel'
import BlockBasedTrackComponent from './components/BlockBasedTrack'
import blockBasedTrack from './blockBasedTrackModel'

export function configSchemaFactory(pluginManager) {
  return ConfigurationSchema(
    'BasicTrack',
    {
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),
      renderer: pluginManager.pluggableConfigSchemaType('renderer'),
    },
    { baseConfiguration: BaseTrackConfig, explicitlyTyped: true },
  )
}

export function stateModelFactory(configSchema) {
  return types.compose(
    'BasicTrack',
    blockBasedTrack,
    types
      .model({
        type: types.literal('BasicTrack'),
        configuration: ConfigurationReference(configSchema),
        height: 100,
      })
      .views(self => ({
        get renderProps() {
          return {
            ...getParentRenderProps(self),
            trackModel: self,
            config: self.configuration.renderer,
          }
        },

        get rendererTypeName() {
          return self.configuration.renderer.type
        },
      }))
      .volatile(() => ({
        reactComponent: BlockBasedTrackComponent,
      })),
  )
}
