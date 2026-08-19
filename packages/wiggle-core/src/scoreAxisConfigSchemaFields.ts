import { types } from '@jbrowse/mobx-state-tree'

import type { ConfigModelForFields } from '@jbrowse/core/configuration'

// The score AXIS alone: exactly the slots `ScoreScaleMixin` reads, and nothing
// else. Split out of `wiggleConfigSchemaFields` below so a display with a score
// axis but none of wiggle's palette/rendering vocabulary can declare the axis
// without inheriting the rest — LinearManhattanDisplay used to extend the whole
// wiggle display schema and advertised twelve slots that did nothing on a GWAS
// track.
//
// `numQuantile` is deliberately NOT here even though `autoscale` names
// `localpercentile`: it is read by the autoscale *computation*
// (`WiggleCommonMixin`), which only the wiggle displays run.
export const scoreAxisConfigSchemaFields = {
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
  displayCrossHatches: {
    type: 'boolean',
    defaultValue: false,
    description:
      'Rule the score axis with horizontal cross hatches at the tick positions — the config form of the score menu\'s "Show cross hatches". Ignored by the density rendering types, which spend color rather than height on the score and so have no axis to rule',
  },
} as const

/**
 * What `ScoreScaleMixin` asks a composing display's `configuration` to be — the
 * slots above and nothing else, which is all the mixin touches. Narrow so
 * `getConf`/`setConf` still check the slot name; see `ConfigModelForFields`.
 */
export type ScoreAxisConfigModel = ConfigModelForFields<
  typeof scoreAxisConfigSchemaFields
>
