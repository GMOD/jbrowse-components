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
    guard &&
      ([
        'featureSequence',
        guard.assemblyName,
        refName,
        start,
        end,
        upDownBp,
        forceLoad,
      ] as const),
    guard &&
      (async (
        _name,
        asmName,
        ref,
        from,
        to,
        flankBp,
        force,
        signal,
        statusCallback,
      ) => {
        if (!force && to - from > BPLIMIT) {
          return {
            error: `Genomic sequence larger than ${BPLIMIT}bp, use "force load" button to display`,
          }
        }
        // three concurrent reads sharing one status field, so each gets its
        // own slot and they aggregate into one bar
        const slot = createStatusFanOut(statusCallback)
        const read = (readStart: number, readEnd: number) =>
          fetchSeq({
            start: readStart,
            end: readEnd,
            refName: ref,
            assemblyName: asmName,
            session: guard.session,
            signal,
            statusCallback: slot(),
          })
        const flank = (flankStart: number, flankEnd: number) =>
          flankBp > 0 ? read(flankStart, flankEnd) : Promise.resolve('')
        const [seq, upstream, downstream] = await Promise.all([
          read(from, to),
          flank(Math.max(0, from - flankBp), from),
          flank(to, to + flankBp),
        ] as const)
        return { seq, upstream, downstream }
      }),
  )

  return { sequence, loading, error, status }
}
