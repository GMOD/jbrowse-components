import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'

import {
  checkStopTokenThrottled,
  checkStopToken,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'
import {
  defaultAttributesToIndex,
  defaultFeatureTypesToExclude,
  generateMeta,
  indexFiles,
  isSupportedIndexingAdapter,
  sanitizeForFilename,
} from '@jbrowse/text-indexing-core'
import { ixIxxStream } from 'ixixx'

import type { indexType } from './util.ts'
import type { StatusCallback } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { Track } from '@jbrowse/text-indexing-core'

export async function indexTracks(args: {
  tracks: Track[]
  outDir: string
  stopToken?: StopToken
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
    stopToken,
  } = args
  const idxType = indexType || 'perTrack'
  checkStopToken(stopToken)
  await (idxType === 'perTrack'
    ? perTrackIndex({
        tracks,
        statusCallback,
        outDir,
        attributesToIndex,
        featureTypesToExclude,
        stopToken,
      })
    : aggregateIndex({
        tracks,
        statusCallback,
        outDir,
        attributesToIndex,
        assemblyNames,
        featureTypesToExclude,
        stopToken,
      }))
  checkStopToken(stopToken)
}

function ensureTrixDir(outDir: string) {
  fs.mkdirSync(path.join(outDir, 'trix'), { recursive: true })
}

async function perTrackIndex({
  tracks,
  statusCallback,
  outDir,
  attributesToIndex = defaultAttributesToIndex,
  featureTypesToExclude = defaultFeatureTypesToExclude,
  stopToken,
}: {
  tracks: Track[]
  statusCallback: StatusCallback | undefined
  outDir: string
  attributesToIndex?: string[]
  featureTypesToExclude?: string[]
  stopToken?: StopToken
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
      stopToken,
    })
  }
}

async function aggregateIndex({
  tracks,
  statusCallback,
  outDir,
  attributesToIndex = defaultAttributesToIndex,
  featureTypesToExclude = defaultFeatureTypesToExclude,
  stopToken,
  assemblyNames,
}: {
  tracks: Track[]
  statusCallback: StatusCallback | undefined
  outDir: string
  attributesToIndex?: string[]
  assemblyNames?: string[]
  featureTypesToExclude?: string[]
  stopToken?: StopToken
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
      stopToken,
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
  stopToken,
}: {
  tracks: Track[]
  outDir: string
  attributesToIndex: string[]
  name: string
  featureTypesToExclude: string[]
  assemblyNames: string[]
  statusCallback: StatusCallback | undefined
  stopToken?: StopToken
}) {
  const checker = createStopTokenChecker(stopToken)
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
        checkStopTokenThrottled(checker)
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
  checkStopToken(stopToken)
  generateMeta({
    configs: tracks,
    attributesToIndex,
    outDir,
    name,
    featureTypesToExclude,
    assemblyNames,
  })
  checkStopToken(stopToken)
}

function runIxIxx(readStream: Readable, idxLocation: string, name: string) {
  const safeName = sanitizeForFilename(name)
  const ixFilename = path.join(idxLocation, 'trix', `${safeName}.ix`)
  const ixxFilename = path.join(idxLocation, 'trix', `${safeName}.ixx`)
  return ixIxxStream(readStream, ixFilename, ixxFilename)
}
