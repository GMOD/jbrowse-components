import { types } from '@jbrowse/mobx-state-tree'

import { WIGGLE_NEG_COLOR_DEFAULT, WIGGLE_POS_COLOR_DEFAULT } from '../util.ts'

export const wiggleConfigSchemaFields = {
  posColor: {
    type: 'color',
    defaultValue: WIGGLE_POS_COLOR_DEFAULT,
    description:
      'Fill color for positive scores, used when useBicolor is true (the default)',
  },
  negColor: {
    type: 'color',
    defaultValue: WIGGLE_NEG_COLOR_DEFAULT,
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
    model: types.enumeration('Autoscale type', [
      'local',
      'localsd',
      'localpercentile',
    ]),
    defaultValue: 'localpercentile',
    description:
      'Autoscale type: "local" uses the min/max in the visible region, "localsd" uses mean ± numStdDev standard deviations, "localpercentile" uses the numQuantile-th percentile score as the max (robust to skewed/peaky data)',
  },
  numStdDev: {
    type: 'number',
    defaultValue: 3,
    description:
      'Number of standard deviations to use for the localsd autoscale type',
    advanced: true,
  },
  numQuantile: {
    type: 'number',
    defaultValue: 0.99,
    description:
      'Upper percentile used as the max for the localpercentile autoscale type (e.g. 0.99 uses the 99th-percentile score as the max, clipping the top 1% of outliers; the min uses the 1st percentile, or 0 for all-positive data)',
    advanced: true,
  },
  // Sentinel promotable slots (like alignments featureHeight): `undefined` is
  // the inherit state and `promotedBase` is what it resolves to when nothing is
  // promoted, so every real value — the base included — stays customizable over
  // a session-wide default. A plain `number` slot would spend its default as
  // the inherit signal, so dragging the slider back to that value would strip
  // to default and silently re-inherit the promoted one. See
  // promotableDefaults.ts.
  scatterPointSize: {
    type: 'maybeNumber',
    defaultValue: undefined,
    promotedBase: 2,
    description:
      'Point height in px for scatterplot ("scatter"/"multiscatter") rendering. Unset (the default) follows the session-wide default for this display type, falling back to 2',
    advanced: true,
    promotable: true,
  },
  lineWidth: {
    type: 'maybeNumber',
    defaultValue: undefined,
    promotedBase: 1,
    description:
      'Line thickness in px for line ("line"/"multiline") rendering. Unset (the default) follows the session-wide default for this display type, falling back to 1',
    advanced: true,
    promotable: true,
  },
} as const
