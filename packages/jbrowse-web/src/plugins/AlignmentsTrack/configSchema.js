import { types } from 'mobx-state-tree'

import { ConfigurationSchema } from '../../configuration'
import { BaseTrackConfig as LinearGenomeTrackConfig } from '../LinearGenomeView/models/model'

export default pluginManager =>
  ConfigurationSchema(
    'AlignmentsTrack',
    {
      adapter: types.union(
        ...pluginManager.getElementTypeMembers('adapter', 'configSchema'),
      ),
      defaultView: {
        type: 'string',
        defaultValue: 'pileup',
      },
      category: {
        type: 'stringArray',
        defaultValue: [],
      },
    },
    { baseConfiguration: LinearGenomeTrackConfig, explicitlyTyped: true },
  )
