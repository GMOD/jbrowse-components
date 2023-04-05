import fs from 'fs'
import path from 'path'
import { Readable } from 'stream'
import { indexGff3 } from './types/gff3Adapter'
import { indexVcf } from './types/vcfAdapter'
import { generateMeta } from './types/common'
import { ixIxxStream } from 'ixixx'
import { Track, indexType, supportedIndexingAdapters } from './util'
import { checkAbortSignal } from '@jbrowse/core/util'

export async function indexTracks(args: {
  tracks: Track[]
  outLocation?: string
  signal?: AbortSignal
  attributes?: string[]
  assemblies?: string[]
  exclude?: string[]
  indexType?: indexType
  statusCallback: (message: string) => void
}) {
  const {
    tracks,
    outLocation,
    attributes,
    exclude,
    assemblies,
    indexType,
    statusCallback,
    signal,
  } = args
  const idxType = indexType || 'perTrack'
  checkAbortSignal(signal)
  await (idxType === 'perTrack'
    ? perTrackIndex(
        tracks,
        statusCallback,
        outLocation,
        attributes,
        exclude,
        signal,
      )
    : aggregateIndex(
        tracks,
        statusCallback,
        outLocation,
        attributes,
        assemblies,
        exclude,
        signal,
      ))
  checkAbortSignal(signal)
  return []
}

async function perTrackIndex(
  tracks: Track[],
  statusCallback: (message: string) => void,
  outLocation?: string,
  attributes?: string[],
  exclude?: string[],
  signal?: AbortSignal,
) {
  const outFlag = outLocation || '.'

  const isDir = fs.lstatSync(outFlag).isDirectory()
  const confFilePath = isDir ? path.join(outFlag, 'config.json') : outFlag
  const outDir = path.dirname(confFilePath)
  const trixDir = path.join(outDir, 'trix')
  if (!fs.existsSync(trixDir)) {
    fs.mkdirSync(trixDir)
  }

  // default settings
  const attrs = attributes || ['Name', 'ID']
  const excludeTypes = exclude || ['exon', 'CDS']
  const force = true
  const supportedTracks = tracks.filter(track =>
    supportedIndexingAdapters(track.adapter?.type),
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
    await indexDriver(
      [trackConfig],
      outDir,
      attrs,
      id,
      true,
      excludeTypes,
      assemblyNames,
      statusCallback,
      signal,
    )
  }
}

async function aggregateIndex(
  tracks: Track[],
  statusCallback: (message: string) => void,
  outLocation?: string,
  attributes?: string[],
  assemblies?: string[],
  exclude?: string[],
  signal?: AbortSignal,
) {
  const outFlag = outLocation || '.'

  const isDir = fs.lstatSync(outFlag).isDirectory()
  const confFilePath = isDir ? path.join(outFlag, 'config.json') : outFlag
  const outDir = path.dirname(confFilePath)
  const trixDir = path.join(outDir, 'trix')
  if (!fs.existsSync(trixDir)) {
    fs.mkdirSync(trixDir)
  }
  if (!assemblies) {
    throw new Error(
      'No assemblies passed. Assmeblies required for aggregate indexes',
    )
  }
  for (const asm of assemblies) {
    // console.log('Indexing assembly ' + asm + '...')
    const id = asm + '-index'
    // default settings
    const attrs = attributes || ['Name', 'ID']
    const excludeTypes = exclude || ['exon', 'CDS']
    // const force = true
    const quiet = true
    // supported tracks for given assembly
    const supportedTracks = tracks
      .filter(track => supportedIndexingAdapters(track.adapter?.type))
      .filter(track => (asm ? track.assemblyNames.includes(asm) : true))

    await indexDriver(
      supportedTracks,
      outDir,
      attrs,
      id,
      quiet,
      excludeTypes,
      [asm],
      statusCallback,
      signal,
    )
  }
}

async function indexDriver(
  tracks: Track[],
  idxLocation: string,
  attributes: string[],
  name: string,
  quiet: boolean,
  exclude: string[],
  assemblyNames: string[],
  statusCallback: (message: string) => void,
  signal?: AbortSignal,
) {
  const readable = Readable.from(
    indexFiles(
      tracks,
      attributes,
      idxLocation,
      quiet,
      exclude,
      statusCallback,
      signal,
    ),
  )
  statusCallback('Indexing files.')
  try {
    const ixIxxStream = await runIxIxx(readable, idxLocation, name)
    checkAbortSignal(signal)
    await generateMeta({
      configs: tracks,
      attributes,
      outDir: idxLocation,
      name,
      exclude,
      assemblyNames,
    })
    checkAbortSignal(signal)
    return ixIxxStream
  } catch (e) {
    throw e
  }
}

async function* indexFiles(
  tracks: Track[],
  attributes: string[],
  outLocation: string,
  quiet: boolean,
  typesToExclude: string[],
  statusCallback: (message: string) => void,
  signal?: AbortSignal,
) {
  for (const track of tracks) {
    const { adapter, textSearching } = track
    const { type } = adapter
    const {
      indexingFeatureTypesToExclude: types = typesToExclude,
      indexingAttributes: attrs = attributes,
    } = textSearching || {}
    // currently only supporting GFF3Tabix and VCFTabix
    switch (type) {
      case 'Gff3TabixAdapter': {
        yield* indexGff3(
          track,
          attrs,
          getLoc('gffGzLocation', track),
          outLocation,
          types,
          quiet,
          statusCallback,
          signal,
        )

        break
      }
      case 'Gff3Adapter': {
        yield* indexGff3(
          track,
          attrs,
          getLoc('gffLocation', track),
          outLocation,
          types,
          quiet,
          statusCallback,
          signal,
        )

        break
      }
      case 'VcfTabixAdapter': {
        yield* indexVcf(
          track,
          attrs,
          getLoc('vcfGzLocation', track),
          outLocation,
          types,
          quiet,
          statusCallback,
          signal,
        )

        break
      }
      case 'VcfAdapter': {
        yield* indexVcf(
          track,
          attrs,
          getLoc('vcfLocation', track),
          outLocation,
          types,
          quiet,
          statusCallback,
          signal,
        )

        break
      }
      // No default
    }
  }
  return
}

function getLoc(attr: string, config: Track) {
  const elt = config.adapter[attr]
  return elt.uri || elt.localPath
}

function runIxIxx(readStream: Readable, idxLocation: string, name: string) {
  const ixFilename = path.join(idxLocation, 'trix', `${name}.ix`)
  const ixxFilename = path.join(idxLocation, 'trix', `${name}.ixx`)
  return ixIxxStream(readStream, ixFilename, ixxFilename)
}
