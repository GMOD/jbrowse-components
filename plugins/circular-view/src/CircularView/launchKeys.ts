import { defineLaunchKeys } from '@jbrowse/core/util/withLaunchInput'

import type { CircularViewCommands } from './types.ts'

// `assembly` and `displayedRegionNames` collide with nothing — the model
// declares neither, and `displayedRegions` is the resolved form of the second.
// `tracks` does collide, and splits per entry: a trackId string or a
// `{ trackId, ...display }` object is a recipe `showTrack` opens, where a built
// track snapshot is state MST restores.
export const circularLaunchKeys = defineLaunchKeys<CircularViewCommands>()({
  assembly: { kind: 'launch' },
  displayedRegionNames: { kind: 'launch' },
  tracks: { kind: 'trackEntries' },
})
