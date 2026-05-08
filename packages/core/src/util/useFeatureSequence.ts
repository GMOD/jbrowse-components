import { fetchSeq } from './fetchSeq.ts'
import { useFetch } from './useFetch.ts'

import type { AbstractSessionModel } from './index.ts'

const BPLIMIT = 20_000_000

export function useFeatureSequence({
  session,
  start,
  end,
  refName,
  upDownBp,
  forceLoad,
  assemblyName,
  shouldFetch = true,
}: {
  assemblyName: string | undefined
  session?: AbstractSessionModel
  start: number
  end: number
  refName: string
  upDownBp: number
  forceLoad: boolean
  shouldFetch?: boolean
}) {
  const active = !!(session && shouldFetch && assemblyName)

  const { data: sequence, error, isLoading: loading } = useFetch(
    active
      ? [
          'featureSequence',
          assemblyName,
          refName,
          start,
          end,
          upDownBp,
          forceLoad,
        ]
      : null,
    async () => {
      if (!forceLoad && end - start > BPLIMIT) {
        return {
          error: `Genomic sequence larger than ${BPLIMIT}bp, use "force load" button to display`,
        }
      }
      const b = start - upDownBp
      const e = end + upDownBp
      const [seq, upstream, downstream] = await Promise.all([
        fetchSeq({ start, end, refName, assemblyName: assemblyName!, session: session! }),
        fetchSeq({
          start: Math.max(0, b),
          end: start,
          refName,
          assemblyName: assemblyName!,
          session: session!,
        }),
        fetchSeq({ start: end, end: e, refName, assemblyName: assemblyName!, session: session! }),
      ] as const)
      return { seq, upstream, downstream }
    },
  )

  return {
    sequence: active ? sequence : undefined,
    loading: active ? loading : false,
    error: active ? error : undefined,
  }
}
