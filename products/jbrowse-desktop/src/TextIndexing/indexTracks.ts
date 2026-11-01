import { checkAbortSignal } from '@jbrowse/core/util/aborting'
import {
  defaultIndexingPolicy,
  isSupportedIndexingAdapter,
  writeTrixIndex,
} from '@jbrowse/text-indexing-core'

import type { StatusCallback } from '@jbrowse/core/util'
import type { IndexingPolicy, Track } from '@jbrowse/text-indexing-core'

/** Index each supported track into its own `<trackId>-index` trix files */
export async function indexTracks({
  tracks,
  outDir,
  policy = defaultIndexingPolicy,
  statusCallback,
  signal,
}: {
  tracks: Track[]
  outDir: string
  signal?: AbortSignal
  policy?: IndexingPolicy
  statusCallback: StatusCallback | undefined
}) {
  checkAbortSignal(signal)
  for (const track of tracks) {
    if (isSupportedIndexingAdapter(track.adapter?.type)) {
      await indexDriver({
        tracks: [track],
        outDir,
        name: `${track.trackId}-index`,
        policy,
        assemblyNames: track.assemblyNames,
        statusCallback,
        signal,
      })
    }
  }
  checkAbortSignal(signal)
}

function indexDriver({
  tracks,
  outDir,
  name,
  policy,
  assemblyNames,
  statusCallback,
  signal,
}: {
  tracks: Track[]
  outDir: string
  name: string
  policy: IndexingPolicy
  assemblyNames?: string[]
  statusCallback: StatusCallback | undefined
  signal?: AbortSignal
}) {
  // accumulate across the tracks of one index so progress is monotonic rather
  // than resetting to zero at each track. The denominator grows as each track's
  // size is discovered (we don't stat every file up front), but the numerator
  // only ever increases
  let bankedBytes = 0
  let cumulativeTotal = 0
  statusCallback?.('Indexing files')
  return writeTrixIndex({
    tracks,
    outDir,
    name,
    policy,
    assemblyNames,
    checkAbort: () => {
      checkAbortSignal(signal)
    },
    onSort: () => {
      statusCallback?.('Sorting and writing index')
    },
    makeProgress: () => {
      let trackTotal = 0
      return {
        onStart: bytes => {
          trackTotal = bytes
          cumulativeTotal += bytes
        },
        onUpdate: bytes => {
          statusCallback?.({
            message: 'Indexing files',
            current: bankedBytes + bytes,
            total: cumulativeTotal,
          })
        },
        onDone: () => {
          bankedBytes += trackTotal
        },
      }
    },
  })
}
