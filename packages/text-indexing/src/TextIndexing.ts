import fs from 'fs'
import path from 'path'
import { Readable } from 'stream'
import { isSupportedIndexingAdapter } from '@jbrowse/core/util'
import { checkStopToken } from '@jbrowse/core/util/stopToken'

// misc
import { ixIxxStream } from 'ixixx'
import { generateMeta } from './types/common'
import { indexGff3 } from './types/gff3Adapter'
import { indexVcf } from './types/vcfAdapter'
import type { Track, indexType } from './util'

export async function indexTracks(args: {
  tracks: Track[]
  outDir?: string
  stopToken?: string
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
  return []
}

async function perTrackIndex({
  tracks,
  statusCallback,
  outDir: paramOutDir,
  attributesToIndex = ['Name', 'ID'],
  featureTypesToExclude = ['exon', 'CDS'],
  stopToken,
}: {
  tracks: Track[]
  statusCallback: (message: string) => void
  outDir?: string
  attributesToIndex?: string[]
  featureTypesToExclude?: string[]
  stopToken?: string
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
  const supportedTracks = tracks.filter(track =>
    isSupportedIndexingAdapter(track.adapter?.type),
  )
  for (const trackConfig of supportedTracks) {
    const { trackId, assemblyNames } = trackConfig
    const id = `${trackId}-index`

    await indexDriver({
      tracks: [trackConfig],
      outDir,
      attributesToIndex,
      name: id,
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
  attributesToIndex = ['Name', 'ID'],
  featureTypesToExclude = ['exon', 'CDS'],
  stopToken,
  assemblyNames,
}: {
  tracks: Track[]
  statusCallback: (message: string) => void
  outDir?: string
  attributesToIndex?: string[]
  assemblyNames?: string[]
  featureTypesToExclude?: string[]
  stopToken?: string
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
  stopToken?: string
}) {
  const readable = Readable.from(
    indexFiles({
      tracks,
      attributesToIndex,
      outDir,
      featureTypesToExclude,
      statusCallback,
      stopToken,
    }),
  )
  statusCallback('Indexing files.')
  await runIxIxx(readable, outDir, name)
  checkStopToken(stopToken)
  await generateMeta({
    configs: tracks,
    attributesToIndex,
    outDir,
    name,
    featureTypesToExclude,
    assemblyNames,
  })
  checkStopToken(stopToken)
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
  stopToken?: string
}) {
  for (const track of tracks) {
    const { adapter, textSearching } = track
    const { type } = adapter || {}
    const {
      indexingFeatureTypesToExclude: featureTypesToExclude = edx1,
      indexingAttributes: attributesToIndex = idx1,
    } = textSearching || {}
    let myTotalBytes: number | undefined
    if (type === 'Gff3Adapter') {
      yield* indexGff3({
        config: track,
        attributesToIndex,
        inLocation: getLoc('gffLocation', track),
        outDir,
        featureTypesToExclude,
        onStart: totalBytes => {
          myTotalBytes = totalBytes
        },
        onUpdate: progressBytes => {
          statusCallback(`${progressBytes}/${myTotalBytes}`)
        },
      })
    }
    if (type === 'Gff3TabixAdapter') {
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
    } else if (type === 'VcfAdapter') {
      yield* indexVcf({
        config: track,
        attributesToIndex,
        inLocation: getLoc('vcfLocation', track),
        outDir,
        onStart: totalBytes => {
          myTotalBytes = totalBytes
        },
        onUpdate: progressBytes => {
          statusCallback(`${progressBytes}/${myTotalBytes}`)
        },
      })
    } else if (type === 'VcfTabixAdapter') {
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
    throw new Error(
      `can't get find ${attr} from ${config.adapter} for text indexing`,
    )
  }
  return elt.uri || elt.localPath
}

function runIxIxx(readStream: Readable, idxLocation: string, name: string) {
  const ixFilename = path.join(idxLocation, 'trix', `${name}.ix`)
  const ixxFilename = path.join(idxLocation, 'trix', `${name}.ixx`)
  return ixIxxStream(readStream, ixFilename, ixxFilename)
}
