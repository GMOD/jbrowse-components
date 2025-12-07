import { getConf } from '@jbrowse/core/configuration'

import type { AbstractSessionModel, Region } from '@jbrowse/core/util'

export async function fetchSequence({
  session,
  region,
}: {
  session: AbstractSessionModel
  region: Region
}) {
  const { rpcManager, assemblyManager } = session
  const assembly = assemblyManager.get(region.assemblyName)
  if (!assembly) {
    throw new Error(`assembly ${region.assemblyName} not found`)
  }

  const sessionId = 'getSequence'
  return rpcManager.call(sessionId, 'CoreGetSequence', {
    adapterConfig: getConf(assembly, ['sequence', 'adapter']),
    region: {
      ...region,
      refName: assembly.getCanonicalRefName(region.refName),
    },
    sessionId,
  }) as Promise<string | undefined>
}
