import { sum } from '@jbrowse/core/util'

import type { TrackLabelMode } from '../types.ts'

interface Display {
  height: number
}
interface Track {
  displays: Display[]
}

export const trackSpacing = 2

export function totalHeight(
  tracks: Track[],
  textHeight: number,
  trackLabels: TrackLabelMode,
) {
  return sum(
    tracks.map(
      t =>
        t.displays[0]!.height +
        (['none', 'left'].includes(trackLabels) ? 0 : textHeight) +
        trackSpacing,
    ),
  )
}
