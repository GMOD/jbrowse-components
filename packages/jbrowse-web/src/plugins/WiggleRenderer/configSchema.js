import { types } from 'mobx-state-tree'
import { ConfigurationSchema } from '../../configuration'

export default ConfigurationSchema(
  'WiggleRenderer',
  {
    color: {
      type: 'color',
      description: 'the color of track, overrides posColor and negColor',
      defaultValue: '#f0f',
      functionSignature: ['feature'],
    },
    posColor: {
      type: 'color',
      description: 'the color to use when the score is positive',
      defaultValue: 'blue',
      functionSignature: ['feature'],
    },
    negColor: {
      type: 'color',
      description: 'the color to use when the score is negative',
      defaultValue: 'red',
      functionSignature: ['feature'],
    },
    highlightColor: {
      type: 'color',
      description: 'the color of highlights over the wiggle track',
      defaultValue: 'rgba(255,255,0,0.5)',
      functionSignature: ['feature'],
    },
    clipColor: {
      type: 'color',
      description: 'the color of the clipping marker',
      defaultValue: 'red',
    },
    renderType: {
      type: 'stringEnum',
      model: types.enumeration('Rendering type', ['xyplot', 'density']),
      description: 'The type of rendering for wiggle data to use',
      defaultValue: 'xyplot',
    },
    filled: {
      type: 'boolean',
      description: 'fill in histogram',
      defaultValue: true,
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
