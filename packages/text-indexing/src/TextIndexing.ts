import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'

import { checkAbortSignal } from '@jbrowse/core/util/aborting'
import {
  TRIX_DIR,
  defaultAttributesToIndex,
  defaultFeatureTypesToExclude,
  generateMeta,
  indexFiles,
  isSupportedIndexingAdapter,
  trixFilePaths,
} from '@jbrowse/text-indexing-core'
import { ixIxxStream } from 'ixixx'

import type { indexType } from './util.ts'
import type { StatusCallback } from '@jbrowse/core/util'
import type { Track } from '@jbrowse/text-indexing-core'

export async function indexTracks(args: {
  tracks: Track[]
  outDir: string
  signal?: AbortSignal
  attributesToIndex?: string[]
  assemblyNames?: string[]
  featureTypesToExclude?: string[]
  indexType?: indexType
  statusCallback: StatusCallback | undefined
}) {
  const {
    tracks,
    outDir,
    attributesToIndex,
    featureTypesToExclude,
    assemblyNames,
    indexType,
    statusCallback,
    signal,
  } = args
  const idxType = indexType || 'perTrack'
  checkAbortSignal(signal)
  await (idxType === 'perTrack'
    ? perTrackIndex({
        tracks,
        statusCallback,
        outDir,
        attributesToIndex,
        featureTypesToExclude,
        signal,
      })
    : aggregateIndex({
        tracks,
        statusCallback,
        outDir,
        attributesToIndex,
        assemblyNames,
        featureTypesToExclude,
        signal,
      }))
  checkAbortSignal(signal)
}

function ensureTrixDir(outDir: string) {
  fs.mkdirSync(path.join(outDir, TRIX_DIR), { recursive: true })
}

async function perTrackIndex({
  tracks,
  statusCallback,
  outDir,
  attributesToIndex = defaultAttributesToIndex,
  featureTypesToExclude = defaultFeatureTypesToExclude,
  signal,
}: {
  tracks: Track[]
  statusCallback: StatusCallback | undefined
  outDir: string
  attributesToIndex?: string[]
  featureTypesToExclude?: string[]
  signal?: AbortSignal
}) {
  ensureTrixDir(outDir)
  const supportedTracks = tracks.filter(track =>
    isSupportedIndexingAdapter(track.adapter?.type),
  )
  for (const trackConfig of supportedTracks) {
    const { trackId, assemblyNames } = trackConfig
    await indexDriver({
      tracks: [trackConfig],
      outDir,
      attributesToIndex,
      name: `${trackId}-index`,
      featureTypesToExclude,
      assemblyNames,
      statusCallback,
      signal,
    })
  }
}

async function aggregateIndex({
  tracks,
  statusCallback,
  outDir,
  attributesToIndex = defaultAttributesToIndex,
  featureTypesToExclude = defaultFeatureTypesToExclude,
  signal,
  assemblyNames,
}: {
  tracks: Track[]
  statusCallback: StatusCallback | undefined
  outDir: string
  attributesToIndex?: string[]
  assemblyNames?: string[]
  featureTypesToExclude?: string[]
  signal?: AbortSignal
}) {
  if (!assemblyNames) {
    throw new Error(
      'No assemblies passed. Assemblies required for aggregate indexes',
    )
  }
  ensureTrixDir(outDir)
  for (const asm of assemblyNames) {
    const supportedTracks = tracks
      .filter(track => isSupportedIndexingAdapter(track.adapter?.type))
      .filter(track => track.assemblyNames.includes(asm))

    await indexDriver({
      tracks: supportedTracks,
      outDir,
      attributesToIndex,
      name: `${asm}-index`,
      featureTypesToExclude,
      assemblyNames: [asm],
      statusCallback,
      signal,
    })
  }
}

async function indexDriver({
  tracks,
  outDir,
  attributesToIndex,
  name,
  featureTypesToExclude,
  assemblyNames,
  statusCallback,
  signal,
}: {
  tracks: Track[]
  outDir: string
  attributesToIndex: string[]
  name: string
  featureTypesToExclude: string[]
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
  const readable = Readable.from(
    indexFiles({
      tracks,
      attributesToIndex,
      outDir,
      featureTypesToExclude,
      checkAbort: () => {
        checkAbortSignal(signal)
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
    }),
  )
  // records stream straight into ixIxx, so 'end' is where the byte counts stop
  // and the sort's own tail begins — otherwise minutes of a bar stuck at 100%
  readable.on('end', () => {
    statusCallback?.('Sorting and writing index')
  })
  statusCallback?.('Indexing files')
  await runIxIxx(readable, outDir, name)
  checkAbortSignal(signal)
  generateMeta({
    configs: tracks,
    attributesToIndex,
    outDir,
    name,
    featureTypesToExclude,
    assemblyNames,
  })
  checkAbortSignal(signal)
}

function runIxIxx(readStream: Readable, idxLocation: string, name: string) {
  const { ix, ixx } = trixFilePaths(idxLocation, name)
  return ixIxxStream(readStream, ix, ixx)
}
