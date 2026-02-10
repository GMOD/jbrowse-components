import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

export default ConfigurationSchema(
  'LinearWiggleDisplay',
  {
    defaultRendering: {
      type: 'stringEnum',
      model: types.enumeration('Rendering type', ['xyplot', 'density', 'line']),
      defaultValue: 'xyplot',
      description: 'Default rendering type',
    },
    height: {
      type: 'number',
      defaultValue: 100,
      description: 'Default height of the track',
    },
    color: {
      type: 'color',
      defaultValue: '#f0f',
      description: 'Color for the wiggle bars',
    },
    posColor: {
      type: 'color',
      defaultValue: '#0068d1',
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
  },
  { explicitlyTyped: true },
)
