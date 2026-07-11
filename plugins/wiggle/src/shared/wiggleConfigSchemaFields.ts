import { types } from '@jbrowse/mobx-state-tree'

import { WIGGLE_POS_COLOR_DEFAULT } from '../util.ts'

export const wiggleConfigSchemaFields = {
  posColor: {
    type: 'color',
    defaultValue: WIGGLE_POS_COLOR_DEFAULT,
    description:
      'Fill color for positive scores, used when useBicolor is true (the default)',
  },
  negColor: {
    type: 'color',
    defaultValue: '#f0636b',
    description:
      'Fill color for negative scores, used when useBicolor is true (the default)',
  },
  bicolorPivot: {
    type: 'number',
    defaultValue: 0,
    description: 'Pivot value for bicolor mode',
    advanced: true,
  },
  minScore: {
    type: 'number',
    defaultValue: Number.MIN_VALUE,
    description:
      'Fixed minimum score bound. The default (Number.MIN_VALUE) is a sentinel meaning "unset, use autoscale"',
    advanced: true,
  },
  maxScore: {
    type: 'number',
    defaultValue: Number.MAX_VALUE,
    description:
      'Fixed maximum score bound. The default (Number.MAX_VALUE) is a sentinel meaning "unset, use autoscale"',
    advanced: true,
  },
  scaleType: {
    type: 'stringEnum',
    model: types.enumeration('Scale type', ['linear', 'log']),
    defaultValue: 'linear',
    description: 'Scale type (linear or log)',
  },
  autoscale: {
    type: 'stringEnum',
    model: types.enumeration('Autoscale type', ['local', 'localsd']),
    defaultValue: 'local',
    description:
      'Autoscale type: "local" uses the min/max in the visible region, "localsd" uses mean ± numStdDev standard deviations',
  },
  numStdDev: {
    type: 'number',
    defaultValue: 3,
    description:
      'Number of standard deviations to use for the localsd autoscale type',
    advanced: true,
  },
  scatterPointSize: {
    type: 'number',
    defaultValue: 2,
    description:
      'Point height in px for scatterplot ("scatter"/"multiscatter") rendering',
    advanced: true,
  },
  lineWidth: {
    type: 'number',
    defaultValue: 1,
    description: 'Line thickness in px for line ("line"/"multiline") rendering',
    advanced: true,
  },
} as const
