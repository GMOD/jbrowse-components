import { readConfObject } from '@jbrowse/core/configuration'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { allSessionTracks, connectedEndpoints } from '@jbrowse/synteny-core'

import type { AssemblyHost, TrackCatalog } from '@jbrowse/core/util'

export interface AddRowOption {
  // dataset and endpoint together, so a dataset reaching two assemblies is two
  // distinct options. JSON-joined rather than glued with a separator: a trackId
  // is free-form, and `a` + `b-c` must not spell the same option as `a-b` + `c`
  id: string
  trackId: string
  name: string
  // assembly added as the new bottom row — the dataset's other endpoint
  newAssembly: string
}

/**
 * What the band above the bottom row already draws: the assembly on its far
 * side, and the datasets it draws with.
 */
export interface LevelAbove {
  assembly: string
  trackIds: string[]
}

/**
 * Options for the "add assembly row" dialog: every endpoint a synteny dataset
 * reaches from `terminalAssembly` is one option, and picking it names both the
 * dataset to draw and the assembly to add.
 *
 * Split in two, because an option that repeats the band above is worse than no
 * option at all — see `alreadyDrawn`, which is what the dialog says instead of
 * offering it.
 */
export function getAddRowOptions({
  session,
  terminalAssembly,
  levelAbove,
}: {
  session: AssemblyHost & TrackCatalog
  terminalAssembly: string
  levelAbove?: LevelAbove
}) {
  // allSessionTracks, not session.tracks: a dataset from a connection extends the
  // stack just as well as a config one
  const { datasets } = connectedEndpoints(
    allSessionTracks(session),
    terminalAssembly,
    session.assemblyManager,
  )
  // A dataset whose only other endpoint the screen removed reaches nowhere, and
  // is dropped rather than offered: every option has to be one `appendRow` can
  // actually open. connectedEndpoints says why.
  const all = datasets.flatMap(({ track, newAssemblies }) => {
    const trackId = readConfObject(track, 'trackId') as string
    const name = getTrackName(track, session)
    return newAssemblies.map(newAssembly => ({
      id: JSON.stringify([trackId, newAssembly]),
      trackId,
      name,
      newAssembly,
    }))
  })
  // The same dataset, back to the same assembly, is the band above drawn a
  // second time upside down under the row it already spans. A pairwise dataset
  // has nothing else to offer, which is why a two-row view opened on its own
  // synteny track used to offer that track and only that track.
  const repeatsAbove = ({ trackId, newAssembly }: AddRowOption) =>
    levelAbove !== undefined &&
    newAssembly === levelAbove.assembly &&
    levelAbove.trackIds.includes(trackId)
  return {
    options: all.filter(o => !repeatsAbove(o)),
    // kept rather than discarded so the dialog can name the dataset it is not
    // offering, instead of claiming nothing connects the bottom row
    alreadyDrawn: all.filter(o => repeatsAbove(o)),
  }
}
