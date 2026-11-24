import { defineLaunchKeys } from '@jbrowse/core/util/withLaunchInput'

import type { CircularViewCommands } from './types.ts'

// `tracks` splits per entry: a trackId or `{ trackId, ...display }` is a
// recipe `showTrack` opens, a built track snapshot is state MST restores.
// `trackSelectorType`, which every v2.10–v4.3.0 view saved, passes through to
// the preProcessSnapshot that drops it.
export const circularLaunchKeys = defineLaunchKeys<CircularViewCommands>()(
  {
    assembly: { kind: 'launch' },
    displayedRegionNames: { kind: 'launch' },
    tracks: { kind: 'trackEntries' },
    autoDiagonalize: { kind: 'launch' },
  },
  { passThrough: ['trackSelectorType'] },
)
