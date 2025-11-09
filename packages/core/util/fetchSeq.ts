import { getConf } from '../configuration'

import type { Feature } from './simpleFeature'
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

  const feats = await rpcManager.call(sessionId, 'CoreGetFeatures', {
    adapterConfig: getConf(assembly, ['sequence', 'adapter']),
    sessionId,
    regions: [
      {
        start,
        end,
        refName: canonicalRefName,
        assemblyName,
      },
    ],
  })

  const [feat] = feats as Feature[]
  return (feat?.get('seq') as string | undefined) || ''
}
