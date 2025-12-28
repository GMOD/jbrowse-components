import { getConf } from '../configuration'

import type { AbstractSessionModel } from './types'

export async function fetchSeq({
  start,
  end,
  refName,
  assemblyName,
  session,
}: {
  start: number
  end: number
  refName: string
  assemblyName: string
  session: AbstractSessionModel
}) {
  const { rpcManager, assemblyManager } = session
  const assembly = await assemblyManager.waitForAssembly(assemblyName)
  if (!assembly) {
    throw new Error('assembly not found')
  }

  const sessionId = 'getSequence'
  const adapterConfig = getConf(assembly, ['sequence', 'adapter'])

  // Get the canonical refName, then translate to the sequence adapter refName
  // (in FASTA). These may differ when refNameAliases override.
  const canonicalRefName = assembly.getCanonicalRefName2(refName)
  const seqAdapterRefName = assembly.getSeqAdapterRefName(canonicalRefName)

  const seq = (await rpcManager.call(sessionId, 'CoreGetSequence', {
    adapterConfig,
    sessionId,
    region: {
      start,
      end,
      refName: seqAdapterRefName,
      assemblyName,
    },
  })) as string | undefined

  return seq ?? ''
}
