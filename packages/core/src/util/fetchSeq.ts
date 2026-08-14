import { getConf } from '../configuration/index.ts'

import type { StatusCallback } from './progress.ts'
import type { StopToken } from './stopToken.ts'
import type { AbstractSessionModel } from './types/index.ts'

export async function fetchSeq({
  start,
  end,
  refName,
  assemblyName,
  session,
  stopToken,
  statusCallback,
}: {
  start: number
  end: number
  refName: string
  assemblyName: string
  session: AbstractSessionModel
  stopToken?: StopToken
  statusCallback?: StatusCallback
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

  const seq = await rpcManager.call(sessionId, 'CoreGetSequence', {
    adapterConfig,
    region: {
      start,
      end,
      refName: seqAdapterRefName,
      assemblyName,
    },
    stopToken,
    statusCallback,
  })

  return seq ?? ''
}
