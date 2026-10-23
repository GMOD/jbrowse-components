import { DEFAULT_GAP_BREAK_MULTIPLE } from '@jbrowse/wiggle-core'

export const wiggleConfigSchemaFields = {
  /**
   * #slot
   */
  resolution: {
    type: 'number',
    defaultValue: 1,
    description:
      'points per pixel the fetch asks a tiered file for: 1 is one per pixel, larger is finer and smaller is coarser. Clamped to the range the Resolution menu offers, so a value outside it reads as the nearest end',
  },
  origin: {
    type: 'number',
    defaultValue: 0,
    description:
      "The value bars grow from, and the cut a threshold color scale with an empty domain uses. The same slot, with the same meaning, as the mark display's origin",
    plot: true,
  },
  size: {
    type: 'maybeNumber',
    description:
      "the mark's size in px, the display's constant for what the mark display spells encoding.size: a point's diameter, 2 while unset, or a line's width, 1 while unset",
    plot: true,
  },
  maxGapMultiple: {
    type: 'number',
    defaultValue: DEFAULT_GAP_BREAK_MULTIPLE,
    description:
      "Interpolated line only: break the line where consecutive points sit further apart than this multiple of the track's own mean point spacing, instead of drawing one long chord across the hole. Scaled to the data rather than a fixed bp distance so it holds at every zoom. 0 keeps one connected line",
    advanced: true,
  },
} as const
