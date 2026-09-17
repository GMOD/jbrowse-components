import { types } from '@jbrowse/mobx-state-tree'
import {
  DEFAULT_GAP_BREAK_MULTIPLE,
  scoreAxisConfigSchemaFields,
  scoreFieldConfigSchemaFields,
} from '@jbrowse/wiggle-core'

import { WIGGLE_NEG_COLOR_DEFAULT, WIGGLE_POS_COLOR_DEFAULT } from '../util.ts'
import { DENSITY_COLOR_RAMPS } from './densityColorRamp.ts'

export const wiggleConfigSchemaFields = {
  ...scoreAxisConfigSchemaFields,
  ...scoreFieldConfigSchemaFields,
  /**
   * #slot
   */
  resolution: {
    type: 'number',
    defaultValue: 1,
    description:
      'how many points per pixel the fetch asks a tiered file for: 1 is one per pixel, larger is finer and smaller is coarser. Clamped to the range the Resolution menu offers, so a value outside it reads as the nearest end',
  },
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
  densityColorRamp: {
    type: 'stringEnum',
    model: types.enumeration('Density color ramp', [...DENSITY_COLOR_RAMPS]),
    defaultValue: 'default',
    description:
      'Color ramp for density ("density"/"multirowdensity") rendering. "default" fades from white at the pivot to the track color; a named ramp (e.g. "viridis") colors scores through that fixed 256-entry lookup table instead, the same table the Hi-C viridis scheme uses',
    advanced: true,
  },
  numQuantile: {
    type: 'number',
    defaultValue: 0.99,
    description:
      'Percentile used to clip outliers for the localpercentile autoscale type (e.g. 0.99 clips the outermost 1% of each sign). Positive and negative extents are computed independently and anchored at 0, so a sparse minority tail (e.g. phyloP acceleration) stays visible; all-positive data pins the min at 0',
    advanced: true,
  },
  scatterPointSize: {
    type: 'number',
    defaultValue: 2,
    description:
      'Point height in px for scatterplot ("scatter"/"multiscatter") rendering. Defaults to 2',
    advanced: true,
  },
  lineWidth: {
    type: 'number',
    defaultValue: 1,
    description:
      'Line thickness in px for line ("line"/"multiline") rendering. Defaults to 1',
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
