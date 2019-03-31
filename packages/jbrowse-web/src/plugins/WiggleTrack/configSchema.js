import { types } from 'mobx-state-tree'
import { ConfigurationSchema } from '../../configuration'
import ConfigurationLayer from '../../configuration/configurationLayer'
import BasicTrackFactory from '../LinearGenomeView/BasicTrack'

export default pluginManager => {
  const { configSchema: BasicTrackConfig } = BasicTrackFactory(pluginManager)

  const baseConfig = ConfigurationSchema(
    'WiggleTrackBase',
    {
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
    },
    { baseConfiguration: BasicTrackConfig, explicitlyTyped: true },
  )

  const withSubtracks = ConfigurationSchema(
    'WiggleTrack',
    {
      subtracks: types.array(ConfigurationLayer(baseConfig)),
    },
    { baseConfiguration: baseConfig, explicitlyTyped: true },
  )

  return withSubtracks
}
