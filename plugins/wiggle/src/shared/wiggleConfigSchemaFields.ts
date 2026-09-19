import { types } from '@jbrowse/mobx-state-tree'
import {
  DEFAULT_GAP_BREAK_MULTIPLE,
  scalesSchema,
  scoreFieldConfigSchemaFields,
  valueScaleSchema,
} from '@jbrowse/wiggle-core'

import { WIGGLE_NEG_COLOR_DEFAULT, WIGGLE_POS_COLOR_DEFAULT } from '../util.ts'
import { DENSITY_COLOR_RAMPS } from './densityColorRamp.ts'

/**
 * The wiggle family's value scale. Spelled beside the palette rather than in
 * the table below it because the doc generator recovers a spread slot table by
 * reading its object literal, and a member built by a call is not one — every
 * wiggle slot left the config pages the once it was in there.
 */
export function wiggleValueScale() {
  return scalesSchema(
    valueScaleSchema({
      types: ['linear', 'log', 'symlog'],
      autoscale: {
        modes: ['local', 'localsd', 'localpercentile'],
        default: 'localpercentile',
      },
    }),
  )
}

export const wiggleConfigSchemaFields = {
  ...scoreFieldConfigSchemaFields,
  /**
   * #slot
   */
  displayCrossHatches: {
    type: 'boolean',
    defaultValue: false,
    description:
      'Rule the score axis with horizontal cross hatches at the tick positions — the config form of the score menu\'s "Show cross hatches". Ignored by the density rendering types, which spend color rather than height on the score and so have no axis to rule',
  },
  /**
   * #slot
   */
  resolution: {
    type: 'number',
    defaultValue: 1,
    description:
      'how many points per pixel the fetch asks a tiered file for: 1 is one per pixel, larger is finer and smaller is coarser. Clamped to the range the Resolution menu offers, so a value outside it reads as the nearest end',
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
