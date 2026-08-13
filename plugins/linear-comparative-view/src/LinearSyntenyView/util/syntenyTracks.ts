import { readConfObject } from '@jbrowse/core/configuration'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { allSessionTracks, connectedEndpoints } from '@jbrowse/synteny-core'

import type { AbstractSessionModel } from '@jbrowse/core/util'

export interface AddRowOption {
  trackId: string
  name: string
  // assembly added as the new bottom row — the dataset's other endpoint
  newAssembly: string
}

/**
 * Options for the "add assembly row" dialog: each synteny dataset referencing
 * `terminalAssembly` becomes one option, whose new assembly is the dataset's
 * other endpoint. The dataset is the unit of extension, so picking it implies
 * the assembly to add.
 */
export function getAddRowOptions(
  session: AbstractSessionModel,
  terminalAssembly: string,
): AddRowOption[] {
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
  return datasets.flatMap(({ track, newAssemblies }) => {
    const [newAssembly] = newAssemblies
    return newAssembly
      ? [
          {
            trackId: readConfObject(track, 'trackId') as string,
            name: getTrackName(track, session),
            newAssembly,
          },
        ]
      : []
  })
}
