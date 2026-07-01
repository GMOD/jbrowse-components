import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'

import { isSupportedIndexingAdapter } from '@jbrowse/core/util'
import {
  checkStopToken2,
  checkStopToken,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'
import {
  defaultAttributesToIndex,
  defaultFeatureTypesToExclude,
  generateMeta,
  indexFiles,
  sanitizeForFilename,
} from '@jbrowse/text-indexing-core'
import { ixIxxStream } from 'ixixx'

import type { indexType } from './util.ts'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { Track } from '@jbrowse/text-indexing-core'

export async function indexTracks(args: {
  tracks: Track[]
  outDir?: string
  stopToken?: StopToken
  attributesToIndex?: string[]
  assemblyNames?: string[]
  featureTypesToExclude?: string[]
  indexType?: indexType
  statusCallback: (message: string) => void
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

function resolveOutDir(outFlag = '.') {
  const isDir = fs.lstatSync(outFlag).isDirectory()
  const confFilePath = isDir ? path.join(outFlag, 'config.json') : outFlag
  const outDir = path.dirname(confFilePath)
  fs.mkdirSync(path.join(outDir, 'trix'), { recursive: true })
  return outDir
}

async function perTrackIndex({
  tracks,
  statusCallback,
  outDir: paramOutDir,
  attributesToIndex = defaultAttributesToIndex,
  featureTypesToExclude = defaultFeatureTypesToExclude,
  stopToken,
}: {
  tracks: Track[]
  statusCallback: (message: string) => void
  outDir?: string
  attributesToIndex?: string[]
  featureTypesToExclude?: string[]
  stopToken?: StopToken
}) {
  const outDir = resolveOutDir(paramOutDir)
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
  outDir: paramOutDir,
  attributesToIndex = defaultAttributesToIndex,
  featureTypesToExclude = defaultFeatureTypesToExclude,
  stopToken,
  assemblyNames,
}: {
  tracks: Track[]
  statusCallback: (message: string) => void
  outDir?: string
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
  const outDir = resolveOutDir(paramOutDir)
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
  statusCallback: (message: string) => void
  stopToken?: StopToken
}) {
  const checker = createStopTokenChecker(stopToken)
  const readable = Readable.from(
    indexFiles({
      tracks,
      attributesToIndex,
      outDir,
      featureTypesToExclude,
      checkAbort: () => {
        checkStopToken2(checker)
      },
      makeProgress: () => {
        let totalBytes = 0
        return {
          onStart: bytes => {
            totalBytes = bytes
          },
          onUpdate: bytes => {
            statusCallback(`${bytes}/${totalBytes}`)
          },
        }
      },
    }),
  )
  statusCallback('Indexing files.')
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
