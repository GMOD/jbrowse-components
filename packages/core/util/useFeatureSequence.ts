import { useMemo } from 'react'

import useSWR from 'swr'

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

  const { data: sequence, error } = useSWR(
    key,
    async params => {
      const { start, end, refName, assemblyName, upDownBp, forceLoad } = params

      if (!forceLoad && end - start > BPLIMIT) {
        return {
          error: `Genomic sequence larger than ${BPLIMIT}bp, use "force load" button to display`,
        }
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
      ])

      return {
        seq,
        upstream,
        downstream,
      }
    },
    {
      shouldRetryOnError: false,
      revalidateOnFocus: false,
    },
  )

  return {
    sequence,
    error,
  }
}
