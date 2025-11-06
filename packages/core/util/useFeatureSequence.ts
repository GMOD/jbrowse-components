import { useEffect, useMemo, useState } from 'react'

import { fetchSeq } from './fetchSeq'

import type { AbstractSessionModel, Feature } from '.'

const BPLIMIT = 20_000_000

export function useFeatureSequence({
  session,
  feature,
  upDownBp,
  forceLoad,
  assemblyName,
  shouldFetch = true,
}: {
  assemblyName: string
  session?: AbstractSessionModel
  feature: Feature
  upDownBp: number
  forceLoad: boolean
  shouldFetch?: boolean
}) {
  const [sequence, setSequence] = useState<
    | {
        seq: string
        upstream: string
        downstream: string
      }
    | { error: string }
  >()
  const [error, setError] = useState<unknown>()
  const [loading, setLoading] = useState(false)

  const key = useMemo(() => {
    if (!session || !shouldFetch) {
      return null
    }

    const start = feature.get('start')
    const end = feature.get('end')
    const refName = feature.get('refName')

    return {
      start,
      end,
      refName,
      assemblyName,
      upDownBp,
      forceLoad,
      sessionId: session.id || 'default',
    }
  }, [session, feature, assemblyName, upDownBp, forceLoad, shouldFetch])

  useEffect(() => {
    if (!key) {
      setSequence(undefined)
      setError(undefined)
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        setLoading(true)
        setError(undefined)

        const { start, end, refName, assemblyName, upDownBp, forceLoad } = key

        if (!forceLoad && end - start > BPLIMIT) {
          setSequence({
            error: `Genomic sequence larger than ${BPLIMIT}bp, use "force load" button to display`,
          })
          return
        }

        const b = start - upDownBp
        const e = end + upDownBp

        const [seq, upstream, downstream] = await Promise.all([
          fetchSeq({
            start,
            end,
            refName,
            assemblyName,
            session: session!,
          }),
          fetchSeq({
            start: Math.max(0, b),
            end: start,
            refName,
            assemblyName,
            session: session!,
          }),
          fetchSeq({
            start: end,
            end: e,
            refName,
            assemblyName,
            session: session!,
          }),
        ] as const)

        setSequence({
          seq,
          upstream,
          downstream,
        })
      } catch (err) {
        setError(err)
      } finally {
        setLoading(false)
      }
    })()
  }, [key, session])

  return {
    sequence,
    loading,
    error,
  }
}
