import { DEFAULT_GAP_BREAK_MULTIPLE } from '@jbrowse/wiggle-core'

export const wiggleConfigSchemaFields = {
  origin: {
    type: 'number',
    defaultValue: 0,
    description:
      "The value bars grow from, and the cut a threshold color scale with an empty domain uses. The same slot, with the same meaning, as the mark display's origin",
    plot: true,
  },
  // Not the mark display's `mark.gapBp` (declined 2026-10-25): that one is
  // bp and a worker fetch input, this one a spacing multiple baked at encode
  maxGapMultiple: {
    type: 'number',
    defaultValue: DEFAULT_GAP_BREAK_MULTIPLE,
    description:
      "Interpolated line only: break the line where consecutive points sit further apart than this multiple of the track's own mean point spacing, instead of drawing one long chord across the hole. Scaled to the data rather than a fixed bp distance so it holds at every zoom. 0 keeps one connected line",
    advanced: true,
  },
} as const
