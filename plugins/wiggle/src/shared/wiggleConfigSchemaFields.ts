import {
  DEFAULT_GAP_BREAK_MULTIPLE,
  scalesSchema,
  scoreFieldConfigSchemaFields,
  valueScaleSchema,
} from '@jbrowse/wiggle-core'

/**
 * The wiggle family's value scale. A function rather than a member of the
 * table below because the doc generator recovers a spread slot table by
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
      rules: true,
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
  origin: {
    type: 'number',
    defaultValue: 0,
    description:
      "The value bars grow from, and the cut a threshold color scale with an empty domain uses. The same slot, with the same meaning, as the mark display's origin",
  },
  size: {
    type: 'number',
    defaultValue: 2,
    description:
      "Point diameter in px in scatter rendering. The same slot, with the same meaning, as the mark display's size",
    advanced: true,
  },
  lineWidth: {
    type: 'number',
    defaultValue: 1,
    description: 'Line thickness in px for line rendering. Defaults to 1',
    advanced: true,
  },
  maxGapMultiple: {
    type: 'number',
    defaultValue: DEFAULT_GAP_BREAK_MULTIPLE,
    description:
      "Interpolated line only: break the line where consecutive points sit further apart than this multiple of the track's own mean point spacing, instead of drawing one long chord across the hole. Scaled to the data rather than a fixed bp distance so it holds at every zoom. 0 disables breaking (the pre-existing behavior, one connected line throughout)",
    advanced: true,
  },
} as const
