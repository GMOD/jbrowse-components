import { types } from 'mobx-state-tree'
import { ConfigurationSchema } from '../../configuration'
import { BaseTrackConfig } from '../LinearGenomeView/models/baseTrack'
import WiggleRendererConfigSchema from '../WiggleRenderer/configSchema'

export default pluginManager =>
  ConfigurationSchema(
    'WiggleTrack',
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
      scaleType: {
        type: 'stringEnum',
        model: types.enumeration('Scale type', ['linear', 'log']), // todo zscale
        description: 'The type of scale to use',
        defaultValue: 'linear',
      },
      inverted: {
        type: 'boolean',
        description: 'draw upside down',
        defaultValue: false,
      },
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),
      renderer: WiggleRendererConfigSchema,
    },
    {
      baseConfiguration: BaseTrackConfig,
      explicitlyTyped: true,
    },
  )
