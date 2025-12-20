import { sum } from '@jbrowse/core/util'

interface Display {
  height: number
}
interface Track {
  displays: Display[]
}

export function totalHeight(
  tracks: Track[],
  textHeight: number,
  trackLabels: string,
) {
  return sum(
    tracks.map(
      t =>
        t.displays[0]!.height +
        (['none', 'left'].includes(trackLabels) ? 0 : textHeight),
    ),
  )
}
