import { fetchSeq } from './fetchSeq.ts'
import { createStatusFanOut } from './progress.ts'
import { useFetch } from './useFetch.ts'

import type { AbstractSessionModel } from './types/index.ts'

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
  const guard = session && assemblyName ? { session, assemblyName } : null

  const {
    data: sequence,
    error,
    isLoading: loading,
    status,
  } = useFetch(
    guard
      ? ([
          'featureSequence',
          guard.assemblyName,
          refName,
          start,
          end,
          upDownBp,
          +forceLoad,
        ] as const)
      : null,
    guard
      ? async (
          _name,
          _asm,
          _ref,
          _start,
          _end,
          _upDown,
          _force,
          stopToken,
          statusCallback,
        ) => {
          const { session: s, assemblyName: asmName } = guard
          if (!forceLoad && end - start > BPLIMIT) {
            return {
              error: `Genomic sequence larger than ${BPLIMIT}bp, use "force load" button to display`,
            }
          }
          // three concurrent reads sharing one status field, so each gets its
          // own slot and they aggregate into one bar
          const slot = createStatusFanOut(statusCallback)
          const [seq, upstream, downstream] = await Promise.all([
            fetchSeq({
              start,
              end,
              refName,
              assemblyName: asmName,
              session: s,
              stopToken,
              statusCallback: slot(),
            }),
            upDownBp > 0
              ? fetchSeq({
                  start: Math.max(0, start - upDownBp),
                  end: start,
                  refName,
                  assemblyName: asmName,
                  session: s,
                  stopToken,
                  statusCallback: slot(),
                })
              : Promise.resolve(''),
            upDownBp > 0
              ? fetchSeq({
                  start: end,
                  end: end + upDownBp,
                  refName,
                  assemblyName: asmName,
                  session: s,
                  stopToken,
                  statusCallback: slot(),
                })
              : Promise.resolve(''),
          ] as const)
          return { seq, upstream, downstream }
        }
      : null,
  )

  return { sequence, loading, error, status }
}
