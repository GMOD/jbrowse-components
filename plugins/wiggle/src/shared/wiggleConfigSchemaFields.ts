import { types } from '@jbrowse/mobx-state-tree'
import {
  DEFAULT_GAP_BREAK_MULTIPLE,
  scoreAxisConfigSchemaFields,
} from '@jbrowse/wiggle-core'

import { WIGGLE_NEG_COLOR_DEFAULT, WIGGLE_POS_COLOR_DEFAULT } from '../util.ts'

import type { ConfigModelForFields } from '@jbrowse/core/configuration'

export const wiggleConfigSchemaFields = {
  ...scoreAxisConfigSchemaFields,
  // Widens the shared axis slot rather than living in it: `symlog` is only
  // offered where something implements it, and that is the wiggle shaders.
  // LinearManhattanDisplay spreads the same shared fields and its shader has no
  // scaleType branch at all, so listing symlog there would advertise a scale it
  // silently draws linear.
  scaleType: {
    type: 'stringEnum',
    model: types.enumeration('Scale type', ['linear', 'log', 'symlog']),
    defaultValue: 'linear',
    description:
      'Scale type. "log" cannot represent 0 or negative scores and floors the domain above them; "symlog" is log-like away from zero and linear through it, so a track whose scores touch or cross 0 keeps them',
  },
  symlogConstant: {
    type: 'number',
    defaultValue: 0,
    description:
      'Width of symlog\'s linear region around zero. The default 0 means "derive from the domain" (a thousandth of its largest magnitude). Setting it to 1 makes symlog exactly log(x+1), which flattens anything living below 1 — set it near the smallest score you need to tell apart instead',
    advanced: true,
  },
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
  numQuantile: {
    type: 'number',
    defaultValue: 0.99,
    description:
      'Percentile used to clip outliers for the localpercentile autoscale type (e.g. 0.99 clips the outermost 1% of each sign). Positive and negative extents are computed independently and anchored at 0, so a sparse minority tail (e.g. phyloP acceleration) stays visible; all-positive data pins the min at 0',
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
    promotedBase: 2,
    description:
      'Point height in px for scatterplot ("scatter"/"multiscatter") rendering. Unset (the default) follows the session-wide default for this display type, falling back to 2',
    advanced: true,
  },
  lineWidth: {
    type: 'maybeNumber',
    promotedBase: 1,
    description:
      'Line thickness in px for line ("line"/"multiline") rendering. Unset (the default) follows the session-wide default for this display type, falling back to 1',
    advanced: true,
  },
  minBarHeight: {
    type: 'number',
    defaultValue: 1,
    description:
      'Bar plot ("xyplot"/"multixyplot") only: shortest a bar may draw, in px, measured from the origin the bars pivot around. A bin whose score sits exactly on that origin otherwise draws a zero-height bar, painting nothing, so a covered stretch of zeros looks identical to a hole with no data. 0 restores that. Overlay multi-wiggle ignores it: every source shares one row there, so the floored bars would land on each other and only the last one drawn would show',
    advanced: true,
  },
  maxGapMultiple: {
    type: 'number',
    defaultValue: DEFAULT_GAP_BREAK_MULTIPLE,
    description:
      'Interpolated line ("linecenter"/"multilinecenter"/"multirowlinecenter") only: break the line where consecutive points sit further apart than this multiple of the track\'s own mean point spacing, instead of drawing one long chord across the hole. Scaled to the data rather than a fixed bp distance so it holds at every zoom. 0 disables breaking (the pre-existing behavior, one connected line throughout)',
    advanced: true,
  },
} as const

/**
 * What `WiggleScoreConfigMixin` asks a composing display's `configuration` to
 * be — this table, which already spreads the score axis. Narrow so
 * `getConf`/`resolveConf`/`setConf` still check the slot name; see
 * `ConfigModelForFields`.
 */
export type WiggleConfigModel = ConfigModelForFields<
  typeof wiggleConfigSchemaFields
>
