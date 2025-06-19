import { useEffect, useState } from 'react'

import { fetchSeq } from './fetchSeq'

import type { AbstractSessionModel, Feature } from '.'
import type { ErrorState, SeqState } from '../BaseFeatureWidget/util'

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
          setSequence({
            seq: await fetchSeq({
              start,
              end,
              refName,
              assemblyName,
              session,
            }),
            upstream: await fetchSeq({
              start: Math.max(0, b),
              end: start,
              refName,
              assemblyName,
              session,
            }),
            downstream: await fetchSeq({
              start: end,
              end: e,
              refName,
              assemblyName,
              session,
            }),
          })
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
