import { types } from 'mobx-state-tree'

import { ConfigurationReference } from '@gmod/jbrowse-core/configuration'

import BlockBasedTrackComponent from '../LinearGenomeView/components/BlockBasedTrack'
import BlockBasedTrack from '../LinearGenomeView/models/blockBasedTrack'
import { getContainingView } from '@gmod/jbrowse-core/util/tracks'

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
          const view = getContainingView(self)
          return {
            bpPerPx: view.bpPerPx,
            horizontallyFlipped: view.horizontallyFlipped,
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
