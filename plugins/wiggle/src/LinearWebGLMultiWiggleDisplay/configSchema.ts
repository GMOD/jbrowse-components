import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

export default ConfigurationSchema(
  'LinearWebGLMultiWiggleDisplay',
  {
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
      model: types.enumeration('Rendering', ['multirowxy', 'multirowdensity']),
      defaultValue: 'multirowxy',
      description: 'Default rendering type',
    },
  },
  { explicitlyTyped: true },
)
