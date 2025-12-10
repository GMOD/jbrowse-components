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
  const canonicalRefName = assembly.getCanonicalRefName(refName)

  const seq = (await rpcManager.call(sessionId, 'CoreGetSequence', {
    adapterConfig: getConf(assembly, ['sequence', 'adapter']),
    sessionId,
    region: {
      start,
      end,
      refName: canonicalRefName,
      assemblyName,
    },
  })) as string | undefined

  return seq ?? ''
}
