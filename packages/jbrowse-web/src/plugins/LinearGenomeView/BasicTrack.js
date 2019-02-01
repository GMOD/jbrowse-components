import { types, getParent } from 'mobx-state-tree'
import blockBasedTrack from './models/blockBasedTrack'
import {
  ConfigurationReference,
  ConfigurationSchema,
} from '../../configuration'
import BlockBasedTrackComponent from './components/BlockBasedTrack'
import { BaseTrackConfig } from './models/baseTrack'

export default pluginManager => {
  const configSchema = ConfigurationSchema(
    'BasicTrack',
    {
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),
      rendering: pluginManager.pluggableConfigSchemaType('renderer'),
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
          const view = getParent(self, 2)
          return {
            bpPerPx: view.bpPerPx,
            horizontallyFlipped: view.horizontallyFlipped,
            trackModel: self,
            config: self.configuration.rendering,
          }
        },

        get rendererTypeName() {
          return self.configuration.rendering.type
        },
      }))
      .volatile(() => ({
        reactComponent: BlockBasedTrackComponent,
      })),
  )

  return { stateModel, configSchema }
}
