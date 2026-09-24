import { checkAbortSignal } from '@jbrowse/core/util/aborting'
import {
  defaultIndexingPolicy,
  isSupportedIndexingAdapter,
  writeTrixIndex,
} from '@jbrowse/text-indexing-core'

import type { indexType } from './util.ts'
import type { StatusCallback } from '@jbrowse/core/util'
import type { IndexingPolicy, Track } from '@jbrowse/text-indexing-core'

export async function indexTracks({
  tracks,
  outDir,
  policy = defaultIndexingPolicy,
  assemblyNames,
  indexType = 'perTrack',
  statusCallback,
  signal,
}: {
  tracks: Track[]
  outDir: string
  signal?: AbortSignal
  policy?: IndexingPolicy
  assemblyNames?: string[]
  indexType?: indexType
  statusCallback: StatusCallback | undefined
}) {
  checkAbortSignal(signal)
  const supported = tracks.filter(track =>
    isSupportedIndexingAdapter(track.adapter?.type),
  )
  const write = (indexed: Track[], name: string, names: string[]) =>
    indexDriver({
      tracks: indexed,
      outDir,
      name,
      policy,
      assemblyNames: names,
      statusCallback,
      signal,
    })
  if (indexType === 'perTrack') {
    for (const track of supported) {
      await write([track], `${track.trackId}-index`, track.assemblyNames)
    }
  } else if (assemblyNames) {
    for (const asm of assemblyNames) {
      await write(
        supported.filter(track => track.assemblyNames.includes(asm)),
        `${asm}-index`,
        [asm],
      )
    }
  } else {
    throw new Error(
      'No assemblies passed. Assemblies required for aggregate indexes',
    )
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
  assemblyNames: string[]
  statusCallback: StatusCallback | undefined
  signal?: AbortSignal
}) {
  // accumulate across tracks so an aggregate index reports monotonic progress
  // rather than resetting to zero at each track. The denominator grows as each
  // track's size is discovered (we don't stat every file up front), but the
  // numerator only ever increases
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
