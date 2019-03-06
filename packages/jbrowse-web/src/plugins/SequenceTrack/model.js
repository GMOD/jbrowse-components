import { types } from 'mobx-state-tree'

import { ConfigurationReference } from '../../configuration'

import BlockBasedTrackComponent from '../LinearGenomeView/components/BlockBasedTrack'
import BlockBasedTrack from '../LinearGenomeView/models/blockBasedTrack'
import { getParentRenderProps } from '../../util/tracks'

export default (pluginManager, configSchema, trackType) =>
  types.compose(
    trackType,
    BlockBasedTrack,
    types
      .model({
        type: types.literal(trackType),
        configuration: ConfigurationReference(configSchema),
        height: 100,
      })
      .views(self => ({
        get renderProps() {
          return {
            ...getParentRenderProps(self),
            trackModel: self,
            config: self.configuration.rendering,
          }
        },
      }))
      .volatile(() => ({
        reactComponent: BlockBasedTrackComponent,
        rendererTypeName: 'DivSequenceRenderer',
      })),
  )
