import { useEffect, useState } from 'react'

import { fetchSeq } from './fetchSeq.ts'

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

  const active = !!(session && shouldFetch && assemblyName)

  useEffect(() => {
    if (!session || !shouldFetch || !assemblyName) {
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        setLoading(true)
        setError(undefined)

        if (!forceLoad && end - start > BPLIMIT) {
          setSequence({
            error: `Genomic sequence larger than ${BPLIMIT}bp, use "force load" button to display`,
          })
          return
        }

        const b = start - upDownBp
        const e = end + upDownBp

        const [seq, upstream, downstream] = await Promise.all([
          fetchSeq({ start, end, refName, assemblyName, session }),
          fetchSeq({
            start: Math.max(0, b),
            end: start,
            refName,
            assemblyName,
            session,
          }),
          fetchSeq({ start: end, end: e, refName, assemblyName, session }),
        ] as const)

        setSequence({ seq, upstream, downstream })
      } catch (e) {
        setError(e)
        setSequence(undefined)
      } finally {
        setLoading(false)
      }
    })()
  }, [
    session,
    shouldFetch,
    start,
    end,
    refName,
    assemblyName,
    upDownBp,
    forceLoad,
  ])

  return {
    sequence: active ? sequence : undefined,
    loading: active ? loading : false,
    error: active ? error : undefined,
  }
}
