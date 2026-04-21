import { types } from '@jbrowse/mobx-state-tree'

import { WIGGLE_POS_COLOR_DEFAULT } from '../util.ts'

export const wiggleConfigSchemaFields = {
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
  autoscale: {
    type: 'stringEnum',
    model: types.enumeration('Autoscale type', [
      'local',
      'global',
      'globalsd',
      'localsd',
    ]),
    defaultValue: 'local',
    description: 'Autoscale type',
  },
  numStdDev: {
    type: 'number',
    defaultValue: 3,
    description:
      'Number of standard deviations to use for autoscale types globalsd or localsd',
  },
} as const
