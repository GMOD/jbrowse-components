import { useEffect, useState } from 'react'

import { getConf } from '../../configuration'

import type { AbstractSessionModel, Feature } from '../../util'
import type { ErrorState, SeqState } from '../util'

const BPLIMIT = 500_000

export function useFeatureSequence({
  session,
  feature,
  upDownBp,
  forceLoad,
  assemblyName,
}: {
  assemblyName: string
  session?: AbstractSessionModel
  feature: Feature
  upDownBp: number
  forceLoad: boolean
}) {
  const [sequence, setSequence] = useState<SeqState | ErrorState>()
  const [error, setError] = useState<unknown>()
  useEffect(() => {
    if (!session) {
      return
    }
    const { assemblyManager, rpcManager } = session
    async function fetchSeq(start: number, end: number, refName: string) {
      const assembly = await assemblyManager.waitForAssembly(assemblyName)
      if (!assembly) {
        throw new Error('assembly not found')
      }
      const sessionId = 'getSequence'
      const feats = await rpcManager.call(sessionId, 'CoreGetFeatures', {
        adapterConfig: getConf(assembly, ['sequence', 'adapter']),
        sessionId,
        regions: [
          {
            start,
            end,
            refName: assembly.getCanonicalRefName(refName),
            assemblyName,
          },
        ],
      })

      const [feat] = feats as Feature[]
      return (feat?.get('seq') as string | undefined) || ''
    }

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        setError(undefined)
        const start = feature.get('start')
        const end = feature.get('end')
        const refName = feature.get('refName')

        if (!forceLoad && end - start > BPLIMIT) {
          setSequence({
            error: `Genomic sequence larger than ${BPLIMIT}bp, use "force load" button to display`,
          })
        } else {
          const b = start - upDownBp
          const e = end + upDownBp
          const seq = await fetchSeq(start, end, refName)
          const up = await fetchSeq(Math.max(0, b), start, refName)
          const down = await fetchSeq(end, e, refName)
          setSequence({ seq, upstream: up, downstream: down })
        }
      } catch (e) {
        console.error(e)
        setError(e)
      }
    })()
  }, [feature, session, assemblyName, upDownBp, forceLoad])

  return {
    sequence,
    error,
  }
}
