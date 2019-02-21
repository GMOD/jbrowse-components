import { types } from 'mobx-state-tree'
import {
  ConfigurationReference,
  ConfigurationSchema,
} from '../../configuration'
import TrackComponent from './components/DynamicTrack'
import baseTrack, { BaseTrackConfig } from './models/baseTrack'
import { getContainingView } from '../../util/tracks'

export default pluginManager => {
  const configSchema = ConfigurationSchema(
    'DynamicTrack',
    {
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),
      renderer: pluginManager.pluggableConfigSchemaType('renderer'),
    },
    { baseConfiguration: BaseTrackConfig, explicitlyTyped: true },
  )

  const stateModel = types.compose(
    'DynamicTrack',
    baseTrack,
    types
      .model({
        type: types.literal('DynamicTrack'),
        configuration: ConfigurationReference(configSchema),
        height: 100,
      })
      .views(self => ({
        get renderProps() {
          const view = getContainingView(self)
          return {
            bpPerPx: view.bpPerPx,
            horizontallyFlipped: view.horizontallyFlipped,
            trackModel: self,
            config: self.configuration.renderer,
          }
        },

        get rendererTypeName() {
          return self.configuration.renderer.type
        },
      }))
      .volatile(() => ({
        reactComponent: TrackComponent,
      })),
  )

  return { stateModel, configSchema }
}
