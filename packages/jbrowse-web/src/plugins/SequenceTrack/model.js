import { types, getParent } from 'mobx-state-tree'

import { ConfigurationReference } from '../../configuration'

import SequenceTrack from './components/SequenceTrack'

import BlockBasedTrack from '../LinearGenomeView/models/blockBasedTrack'

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
          const view = getParent(self, 2)
          return {
            bpPerPx: view.bpPerPx,
            horizontallyFlipped: view.horizontallyFlipped,
            trackModel: self,
            config: self.configuration.rendering,
          }
        },
      }))
      .volatile(() => ({
        reactComponent: SequenceTrack,
        rendererTypeName: 'DivSequenceRenderer',
      })),
  )
