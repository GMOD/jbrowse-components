import { readConfObject } from '@jbrowse/core/configuration'
import { canonicalAssemblyNames, getTrackName } from '@jbrowse/core/util/tracks'
import { allSessionTracks, getSyntenyTracks } from '@jbrowse/synteny-core'

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
  const { assemblyManager } = session
  const tracks = getSyntenyTracks(
    allSessionTracks(session),
    [terminalAssembly],
    assemblyManager,
  )
  // canonical on both sides of the comparison and in the result: newAssembly
  // becomes an assembly row, and an alias read off the track config would name
  // a row the rest of the form can't match
  const [canonicalTerminal = terminalAssembly] = canonicalAssemblyNames(
    [terminalAssembly],
    assemblyManager,
  )
  return (
    tracks
      .map(track => {
        const assemblyNames = canonicalAssemblyNames(
          readConfObject(track, 'assemblyNames') as string[],
          assemblyManager,
        )
        return {
          trackId: readConfObject(track, 'trackId') as string,
          name: getTrackName(track, session),
          newAssembly:
            assemblyNames.find(name => name !== canonicalTerminal) ??
            canonicalTerminal,
        }
      })
      // Every option has to be one `appendRow` can actually open, and a track
      // config is free to name an assembly the session doesn't have — a hub
      // whose assemblies were never loaded, or a config one was removed from.
      // Picking one of those is not a broken row but a broken view: the row's
      // init fails with "Assembly X not found", which sets the whole synteny
      // view's error, and `showImportForm` reads that error — so choosing an
      // offered option replaced the user's working stack with the import form.
      //
      // `getCanonicalAssemblyName` is the exact test, since it is undefined for
      // a name the manager cannot resolve and is what the row's init resolves
      // through. A self-alignment's endpoint is the terminal row's own
      // assembly, which is live by construction, so it survives this.
      .filter(
        o =>
          assemblyManager.getCanonicalAssemblyName(o.newAssembly) !== undefined,
      )
  )
}
