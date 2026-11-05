import { fetchSeq } from './fetchSeq.ts'
import { createStatusFanOut } from './progress.ts'
import { useFetch } from './useFetch.ts'

import type { AbstractSessionModel } from './types/index.ts'

const BPLIMIT = 20_000_000

/**
 * `[start, end)` as the stretches of a circular sequence `length` long that it
 * covers, each back on the sequence: a range past the origin goes round to the
 * sequence's start.
 */
function stretchesRound(start: number, end: number, length: number) {
  const stretches = []
  let from = start
  while (from < end) {
    const lap = Math.floor(from / length) * length
    const to = Math.min(end, lap + length)
    stretches.push({ start: from - lap, end: to - lap })
    from = to
  }
  return stretches
}

/**
 * `circularLength` is the length of a circular sequence the feature crosses
 * the origin of, which GFF3 writes with an end past that length: the feature's
 * reads, its downstream flank included, go round the origin. The key carries
 * only whether there is one: the length follows from the assembly and refName,
 * and an undefined key part would hold the fetch.
 */
export function useFeatureSequence({
  session,
  start,
  end,
  refName,
  upDownBp,
  forceLoad,
  assemblyName,
  circularLength,
}: {
  assemblyName: string | undefined
  session?: AbstractSessionModel
  start: number
  end: number
  refName: string
  upDownBp: number
  forceLoad: boolean
  circularLength?: number
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
        circularLength !== undefined,
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
        _crossesOrigin,
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
        const readStretch = (readStart: number, readEnd: number) =>
          fetchSeq({
            start: readStart,
            end: readEnd,
            refName: ref,
            assemblyName: asmName,
            session: guard.session,
            signal,
            statusCallback: slot(),
          })
        const read = async (readStart: number, readEnd: number) =>
          circularLength === undefined
            ? readStretch(readStart, readEnd)
            : (
                await Promise.all(
                  stretchesRound(readStart, readEnd, circularLength).map(s =>
                    readStretch(s.start, s.end),
                  ),
                )
              ).join('')
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
