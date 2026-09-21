import { defineLaunchKeys } from '@jbrowse/core/util/withLaunchInput'

import type { DotplotViewCommands } from './types.ts'

// `views` is an unconditional lift: the model declares `hview` and `vview` and
// derives `views` as a getter, so a spec's per-axis list collides with nothing.
// `tracks` does collide, and splits per entry — a trackId string is a recipe
// where a built track snapshot is state. `highlight` is a launch key only: the
// entries land on the session's list.
//
// Everything else a spec can write is a declared property: `colorBy`, `alpha`,
// `minAlignmentLength`, `lodMode`, … . MST restores those natively, so none of
// them is a launch key.
export const dotplotLaunchKeys = defineLaunchKeys<DotplotViewCommands>()({
  views: { kind: 'launch' },
  tracks: { kind: 'trackEntries' },
  highlight: { kind: 'launch' },
  autoDiagonalize: { kind: 'launch' },
})
