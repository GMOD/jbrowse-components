import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'

export default ConfigurationSchema(
  'WiggleRenderer',
  {
    color: {
      type: 'color',
      description: 'the color of track, overrides posColor and negColor',
      defaultValue: '#f0f',
    },
    posColor: {
      type: 'color',
      description: 'the color to use when the score is positive',
      defaultValue: 'blue',
    },
    negColor: {
      type: 'color',
      description: 'the color to use when the score is negative',
      defaultValue: 'red',
    },
    highlightColor: {
      type: 'color',
      description: 'the color of highlights over the wiggle track',
      defaultValue: 'rgba(255,255,0,0.5)',
    },
    clipColor: {
      type: 'color',
      description: 'the color of the clipping marker',
      defaultValue: 'red',
    },
    bicolorPivot: {
      type: 'stringEnum',
      model: types.enumeration('Scale type', [
        'numeric',
        'mean',
        'z_score',
        'none',
      ]),
      description: 'type of bicolor pivot',
      defaultValue: 'numeric',
    },
    bicolorPivotValue: {
      type: 'number',
      defaultValue: 0,
      description: 'value to use for bicolor pivot',
    },
  },
  { explicitlyTyped: true },
)
