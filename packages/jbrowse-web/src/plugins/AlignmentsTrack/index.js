import { types } from 'mobx-state-tree'

import Plugin, { TrackType } from '../../Plugin'
import { ConfigurationSchema } from '../../configuration'
import { BaseTrack as LinearGenomeTrack } from '../LinearGenomeView/models/model'
import AlignmentsTrack from './components/AlignmentsTrack'

const stateModel = types.compose(
  'AlignmentsTrack',
  LinearGenomeTrack,
  types
    .model({
      type: types.literal('AlignmentsTrack'),
    })
    .views(self => ({
      get RenderingComponent() {
        return AlignmentsTrack
      },
    })),
)

export default class AlignmentsTrackPlugin extends Plugin {
  install(pluginManager) {
    pluginManager.addTrackType(() => {
      const configSchema = ConfigurationSchema('AlignmentsTrack', {
        adapter: types.union(
          ...pluginManager.getElementTypeMembers('adapter', 'configSchema'),
        ),
        defaultView: {
          type: 'string',
          defaultValue: 'pileup',
        },
      })

      return new TrackType({
        name: 'Alignments',
        configSchema,
        stateModel,
        RenderingComponent: AlignmentsTrack,
      })
    })
  }
}
