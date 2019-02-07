import { types } from 'mobx-state-tree'

import { ConfigurationReference } from '../../configuration'

import BlockBasedTrackComponent from '../LinearGenomeView/components/BlockBasedTrack'
import BlockBasedTrack from '../LinearGenomeView/models/blockBasedTrack'
import { getContainingView } from '../../util/tracks'

export default (pluginManager, configSchema) =>
  types.compose(
    'SequenceTrack',
    BlockBasedTrack,
    types
      .model({
        type: types.literal('SequenceTrack'),
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
