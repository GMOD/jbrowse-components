import { types } from 'mobx-state-tree'
import { ConfigurationSchema } from '../../configuration'
import { BaseTrackConfig as LinearGenomeTrackConfig } from '../LinearGenomeView/models/baseTrack'

export default pluginManager =>
  ConfigurationSchema(
    'WiggleTrack',
    {
      subtracks: types.array(
        pluginManager.getTrackType('BasicTrack').configSchema,
      ),
      autoscale: {
        type: 'stringEnum',
        defaultValue: 'global',
        model: types.enumeration('Autoscale type', ['global', 'local']),
        description: 'performs local or global autoscaling',
      },
      minScore: {
        type: 'number',
        defaultValue: -Infinity,
        description: 'minimum value for the y-scale',
      },
      maxScore: {
        type: 'number',
        description: 'maximum value for the y-scale',
        defaultValue: Infinity,
      },
      defaultHeight: {
        type: 'number',
        description: 'default height for a subtrack',
        defaultValue: 100,
      },
    },
    { baseConfiguration: LinearGenomeTrackConfig, explicitlyTyped: true },
  )
