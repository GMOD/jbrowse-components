import { types } from 'mobx-state-tree'

import { ConfigurationReference } from '../../configuration'

import BlockBasedTrackComponent from '../LinearGenomeView/components/BlockBasedTrack'
import BlockBasedTrack from '../LinearGenomeView/models/blockBasedTrack'

export default (pluginManager, configSchema) =>
  types.compose(
    'WiggleTrack',
    BlockBasedTrack,
    types
      .model({
        type: types.literal('WiggleTrack'),
        configuration: ConfigurationReference(configSchema),
      })

      .volatile(() => ({
        reactComponent: BlockBasedTrackComponent,
        rendererTypeName: 'WiggleRenderer',
      })),
  )
