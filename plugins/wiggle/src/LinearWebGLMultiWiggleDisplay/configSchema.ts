import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { WIGGLE_POS_COLOR_DEFAULT } from '../util'

export default ConfigurationSchema(
  'MultiLinearWiggleDisplay',
  {
    posColor: {
      type: 'color',
      defaultValue: WIGGLE_POS_COLOR_DEFAULT,
      description: 'Color for positive scores (when using bicolor)',
    },
    negColor: {
      type: 'color',
      defaultValue: '#f0636b',
      description: 'Color for negative scores (when using bicolor)',
    },
    bicolorPivot: {
      type: 'number',
      defaultValue: 0,
      description: 'Pivot value for bicolor mode',
    },
    height: {
      type: 'number',
      defaultValue: 200,
      description: 'Default height of the track',
    },
    minScore: {
      type: 'number',
      defaultValue: Number.MIN_VALUE,
      description: 'Minimum score bound',
    },
    maxScore: {
      type: 'number',
      defaultValue: Number.MAX_VALUE,
      description: 'Maximum score bound',
    },
    scaleType: {
      type: 'stringEnum',
      model: types.enumeration('Scale type', ['linear', 'log']),
      defaultValue: 'linear',
      description: 'Scale type (linear or log)',
    },
    defaultRendering: {
      type: 'stringEnum',
      model: types.enumeration('Rendering', [
        'multirowxy',
        'multirowdensity',
        'multirowline',
      ]),
      defaultValue: 'multirowxy',
      description: 'Default rendering type',
    },
  },
  { explicitlyTyped: true },
)
