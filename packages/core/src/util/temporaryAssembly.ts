import { getConfAssemblyNamesOrNone } from './tracks.ts'

import type { AnyConfiguration } from '../configuration/index.ts'

interface SessionAskingItsAssemblyManager {
  assemblyManager: { isTemporaryAssembly: (name: string) => boolean }
}

function asksItsAssemblyManager(
  session: unknown,
): session is SessionAskingItsAssemblyManager {
  return (
    typeof session === 'object' &&
    session !== null &&
    'assemblyManager' in session &&
    typeof session.assemblyManager === 'object' &&
    session.assemblyManager !== null &&
    'isTemporaryAssembly' in session.assemblyManager
  )
}

/**
 * Whether a track config names a temporary assembly: one a view or display
 * declares (a read-vs-ref read, a multi-way lane) or a plugin put in
 * `session.temporaryAssemblies`, which goes when its owner does. `some`, since
 * a config half of whose assemblies survive still draws nothing. ADR-084.
 */
export function namesTemporaryAssembly(
  session: unknown,
  trackConf: AnyConfiguration,
) {
  return (
    asksItsAssemblyManager(session) &&
    getConfAssemblyNamesOrNone(trackConf).some(name =>
      session.assemblyManager.isTemporaryAssembly(name),
    )
  )
}
