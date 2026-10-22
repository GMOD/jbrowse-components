import { defineLaunchKeys } from '@jbrowse/core/util/withLaunchInput'

import type { CircularViewCommands } from './types.ts'

// `tracks` splits per entry: a trackId or `{ trackId, ...display }` is a
// recipe `showTrack` opens, a built track snapshot is state MST restores
export const circularLaunchKeys = defineLaunchKeys<CircularViewCommands>()({
  assembly: { kind: 'launch' },
  displayedRegionNames: { kind: 'launch' },
  tracks: { kind: 'trackEntries' },
  autoDiagonalize: { kind: 'launch' },
})
