import { getConf } from '@jbrowse/core/configuration'

import type { AbstractSessionModel, Feature, Region } from '@jbrowse/core/util'

export async function fetchSequence({
  session,
  regions,
  signal,
  assemblyName,
}: {
  assemblyName: string
  session: AbstractSessionModel
  regions: Region[]
  signal?: AbortSignal
}) {
  const { rpcManager, assemblyManager } = session
  const assembly = assemblyManager.get(assemblyName)
  if (!assembly) {
    throw new Error(`assembly ${assemblyName} not found`)
  }

  const sessionId = 'getSequence'
  return rpcManager.call(sessionId, 'CoreGetFeatures', {
    adapterConfig: getConf(assembly, ['sequence', 'adapter']),
    regions: regions.map(r => ({
      ...r,
      refName: assembly.getCanonicalRefName(r.refName),
    })),
    sessionId,
    signal,
  }) as Promise<Feature[]>
}
