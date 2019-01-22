import { types } from 'mobx-state-tree'

import { ConfigurationReference } from '../../../configuration'

import SequenceTrack from '../components/SequenceTrack'

import BlockBasedTrack from '../../LinearGenomeView/models/blockBasedTrack'

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
      .volatile(() => ({
        reactComponent: SequenceTrack,
        rendererTypeName: 'DivSequenceRenderer',
      })),
  )
