import {
  fileToLocation,
  getEnv,
  getSession,
  isSessionWithAddSessionTrack,
} from '@jbrowse/core/util'
import { pairIndexFiles } from '@jbrowse/core/util/indexCandidates'
import { guessTrackConfForLocation } from '@jbrowse/core/util/tracks'

import type { LinearGenomeViewModel } from './model.ts'

// Every type is guessed before any track is added, so a selection holding one
// file of no known type adds nothing rather than half of itself.
export async function showFiles(
  view: LinearGenomeViewModel,
  files: readonly File[],
) {
  const session = getSession(view)
  if (!isSessionWithAddSessionTrack(session)) {
    throw new Error('this session does not take new tracks')
  }
  const { pluginManager } = getEnv(view)
  const assemblyName = view.assemblyNames[0] ?? view.launchAssemblyName
  const confs = pairIndexFiles(files).map(({ data, index }) =>
    guessTrackConfForLocation(
      fileToLocation(data),
      index && fileToLocation(index),
      pluginManager,
      assemblyName,
    ),
  )
  for (const conf of confs) {
    session.addSessionTrackConf(conf)
  }
  await Promise.all(confs.map(conf => view.launchTrack(conf.trackId)))
  return confs.map(conf => conf.trackId)
}
