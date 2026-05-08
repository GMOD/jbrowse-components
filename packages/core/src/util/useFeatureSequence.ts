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
}: {
  assemblyName: string | undefined
  session?: AbstractSessionModel
  start: number
  end: number
  refName: string
  upDownBp: number
  forceLoad: boolean
}) {
  const guard =
    session && assemblyName ? { session, assemblyName } : null

  const { data: sequence, error, isLoading: loading } = useFetch(
    guard
      ? ['featureSequence', guard.assemblyName, refName, start, end, upDownBp, +forceLoad]
      : null,
    guard
      ? async () => {
          const { session: s, assemblyName: asmName } = guard
          if (!forceLoad && end - start > BPLIMIT) {
            return {
              error: `Genomic sequence larger than ${BPLIMIT}bp, use "force load" button to display`,
            }
          }
          const b = start - upDownBp
          const e = end + upDownBp
          const [seq, upstream, downstream] = await Promise.all([
            fetchSeq({ start, end, refName, assemblyName: asmName, session: s }),
            fetchSeq({ start: Math.max(0, b), end: start, refName, assemblyName: asmName, session: s }),
            fetchSeq({ start: end, end: e, refName, assemblyName: asmName, session: s }),
          ] as const)
          return { seq, upstream, downstream }
        }
      : null,
  )

  return { sequence, loading, error }
}
