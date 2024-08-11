import fs from 'fs'
import path from 'path'
import { Readable } from 'stream'
import { indexGff3 } from './types/gff3Adapter'
import { indexVcf } from './types/vcfAdapter'
import { generateMeta } from './types/common'
import { ixIxxStream } from 'ixixx'
import { Track, indexType } from './util'
import {
  checkAbortSignal,
  isSupportedIndexingAdapter,
} from '@jbrowse/core/util'

export async function indexTracks(args: {
  tracks: Track[]
  outDir?: string
  signal?: AbortSignal
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
  return []
}

async function perTrackIndex({
  tracks,
  statusCallback,
  outDir: paramOutDir,
  attributesToIndex = ['Name', 'ID'],
  featureTypesToExclude = ['exon', 'CDS'],
  signal,
}: {
  tracks: Track[]
  statusCallback: (message: string) => void
  outDir?: string
  attributesToIndex?: string[]
  featureTypesToExclude?: string[]
  signal?: AbortSignal
}) {
  const outFlag = paramOutDir || '.'

  const isDir = fs.lstatSync(outFlag).isDirectory()
  const confFilePath = isDir ? path.join(outFlag, 'config.json') : outFlag
  const outDir = path.dirname(confFilePath)
  const trixDir = path.join(outDir, 'trix')
  if (!fs.existsSync(trixDir)) {
    fs.mkdirSync(trixDir)
  }

  // default settings
  const force = true
  const supportedTracks = tracks.filter(track =>
    isSupportedIndexingAdapter(track.adapter?.type),
  )
  for (const trackConfig of supportedTracks) {
    const { textSearching, trackId, assemblyNames } = trackConfig
    const id = `${trackId}-index`
    if (textSearching?.textSearchAdapter && !force) {
      console.warn(
        `Note: ${trackId} has already been indexed with this configuration, use --force to overwrite this track. Skipping for now`,
      )
      continue
    }
    await indexDriver({
      tracks: [trackConfig],
      outDir,
      attributesToIndex,
      name: id,
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
  outDir: paramOutDir,
  attributesToIndex = ['Name', 'ID'],
  featureTypesToExclude = ['exon', 'CDS'],
  signal,
  assemblyNames,
}: {
  tracks: Track[]
  statusCallback: (message: string) => void
  outDir?: string
  attributesToIndex?: string[]
  assemblyNames?: string[]
  featureTypesToExclude?: string[]
  signal?: AbortSignal
}) {
  const outFlag = paramOutDir || '.'
  const isDir = fs.lstatSync(outFlag).isDirectory()
  const confFilePath = isDir ? path.join(outFlag, 'config.json') : outFlag
  const outDir = path.dirname(confFilePath)
  const trixDir = path.join(outDir, 'trix')
  if (!fs.existsSync(trixDir)) {
    fs.mkdirSync(trixDir)
  }
  if (!assemblyNames) {
    throw new Error(
      'No assemblies passed. Assmeblies required for aggregate indexes',
    )
  }
  for (const asm of assemblyNames) {
    const id = `${asm}-index`
    const supportedTracks = tracks
      .filter(track => isSupportedIndexingAdapter(track.adapter?.type))
      .filter(track => (asm ? track.assemblyNames.includes(asm) : true))

    await indexDriver({
      tracks: supportedTracks,
      outDir: outDir,
      attributesToIndex,
      name: id,
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
  statusCallback: (message: string) => void
  signal?: AbortSignal
}) {
  const readable = Readable.from(
    indexFiles({
      tracks,
      attributesToIndex,
      outDir,
      featureTypesToExclude,
      statusCallback,
      signal,
    }),
  )
  statusCallback('Indexing files.')
  const ixIxxStream = await runIxIxx(readable, outDir, name)
  checkAbortSignal(signal)
  await generateMeta({
    configs: tracks,
    attributesToIndex,
    outDir,
    name,
    featureTypesToExclude,
    assemblyNames,
  })
  checkAbortSignal(signal)
  return ixIxxStream
}

async function* indexFiles({
  tracks,
  attributesToIndex: idx1,
  outDir,
  featureTypesToExclude: edx1,
  statusCallback,
}: {
  tracks: Track[]
  attributesToIndex: string[]
  outDir: string
  featureTypesToExclude: string[]
  statusCallback: (message: string) => void
  signal?: AbortSignal
}) {
  for (const track of tracks) {
    const { adapter, textSearching } = track
    const { type } = adapter || {}
    const {
      indexingFeatureTypesToExclude: featureTypesToExclude = edx1,
      indexingAttributes: attributesToIndex = idx1,
    } = textSearching || {}
    let myTotalBytes: number | undefined
    if (type === 'Gff3TabixAdapter' || type === 'Gff3Adapter') {
      yield* indexGff3({
        config: track,
        attributesToIndex,
        inLocation: getLoc('gffGzLocation', track),
        outDir,
        featureTypesToExclude,
        onStart: totalBytes => {
          myTotalBytes = totalBytes
        },
        onUpdate: progressBytes => {
          statusCallback(`${progressBytes}/${myTotalBytes}`)
        },
      })
    } else if (type === 'VcfTabixAdapter' || type === 'VcfAdapter') {
      yield* indexVcf({
        config: track,
        attributesToIndex,
        inLocation: getLoc('vcfGzLocation', track),
        outDir,
        onStart: totalBytes => {
          myTotalBytes = totalBytes
        },
        onUpdate: progressBytes => {
          statusCallback(`${progressBytes}/${myTotalBytes}`)
        },
      })
    }
  }
  return
}

function getLoc(attr: string, config: Track) {
  const elt = config.adapter?.[attr] as
    | { uri: string; localPath: string }
    | undefined
  if (!elt) {
    throw new Error('none')
  }
  return elt.uri || elt.localPath
}

function runIxIxx(readStream: Readable, idxLocation: string, name: string) {
  const ixFilename = path.join(idxLocation, 'trix', `${name}.ix`)
  const ixxFilename = path.join(idxLocation, 'trix', `${name}.ixx`)
  return ixIxxStream(readStream, ixFilename, ixxFilename)
}
