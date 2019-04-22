import { types } from 'mobx-state-tree'
import blockBasedTrack from './models/blockBasedTrack'
import {
  ConfigurationReference,
  ConfigurationSchema,
} from '../../configuration'
import BlockBasedTrackComponent from './components/BlockBasedTrack'
import { BaseTrackConfig } from './models/baseTrack'
import { getParentRenderProps } from '../../util/tracks'

export default pluginManager => {
  const configSchema = ConfigurationSchema(
    'BasicTrack',
    {
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),
      renderer: pluginManager.pluggableConfigSchemaType('renderer'),
    },
    { baseConfiguration: BaseTrackConfig, explicitlyTyped: true },
  )

  const stateModel = types.compose(
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

  return { stateModel, configSchema }
}
