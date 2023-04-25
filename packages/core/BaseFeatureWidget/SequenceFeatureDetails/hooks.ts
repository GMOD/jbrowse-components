import { useEffect, useState } from 'react'

import { SeqState, ErrorState } from '../util'
import { Feature, SimpleFeatureSerialized, getSession } from '../../util'
import { getConf } from '../../configuration'

const BPLIMIT = 500_000

interface CoordFeat extends SimpleFeatureSerialized {
  refName: string
  start: number
  end: number
}

export function useFeatureSequence(
  model: { view: { assemblyNames: string[] } } | undefined,
  feature: SimpleFeatureSerialized,
  upDownBp: number,
  forceLoad: boolean,
) {
  const [sequence, setSequence] = useState<SeqState | ErrorState>()
  const [error, setError] = useState<unknown>()
  useEffect(() => {
    let finished = false
    if (!model) {
      return () => {}
    }
    const { assemblyManager, rpcManager } = getSession(model)
    const [assemblyName] = model.view?.assemblyNames || []
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
        const { start, end, refName } = feature as CoordFeat

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
          if (!finished) {
            setSequence({ seq, upstream: up, downstream: down })
          }
        }
      } catch (e) {
        console.error(e)
        setError(e)
      }
    })()

    return () => {
      finished = true
    }
  }, [feature, model, upDownBp, forceLoad])
  return { sequence, error }
}
