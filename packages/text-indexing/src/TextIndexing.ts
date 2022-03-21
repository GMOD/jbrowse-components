// import { AnyConfigurationModel } from '../configuration/configurationSchema'
import fs from 'fs'
import path from 'path'
import { Readable } from 'stream'
import { indexGff3 } from './types/gff3Adapter'
import { indexVcf } from './types/vcfAdapter'
import { generateMeta, supported } from './types/common'
import { ixIxxStream } from 'ixixx'
import { Track } from './util'

type indexType = 'aggregate' | 'perTrack'

export async function indexTracks(args: {
  tracks: Track[] // array of trackIds to index
  outLocation?: string
  signal?: AbortSignal
  attributes?: string[]
  assemblies?: string[]
  exclude?: string[]
  indexType?: indexType
}) {
  const { tracks, outLocation, attributes, exclude, assemblies, indexType } =
    args
  const idxType = indexType || 'perTrack'
  if (idxType === 'perTrack') {
    await perTrackIndex(tracks, outLocation, attributes, assemblies, exclude)
  } else {
    await aggregateIndex(tracks, outLocation, attributes, assemblies, exclude)
  }
  return []
}

async function perTrackIndex(
  tracks: Track[],
  outLocation?: string,
  attributes?: string[],
  assemblies?: string[],
  exclude?: string[],
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
  const supportedTracks = tracks.filter(track => supported(track.adapter?.type))
  for (const trackConfig of supportedTracks) {
    const { textSearching, trackId, assemblyNames } = trackConfig
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
      trackId,
      true,
      excludeTypes,
      assemblyNames,
    )
  }
}

async function aggregateIndex(
  tracks: Track[],
  outLocation?: string,
  attributes?: string[],
  assemblies?: string[],
  exclude?: string[],
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
    console.log('Indexing assembly ' + asm + '...')
    const id = asm + '-index'
    console.log('id', id)
    // const foundIdx = aggregateAdapters.findIndex(
    //   x => x.textSearchAdapterId === id,
    // )
    // if (foundIdx !== -1 && !force) {
    //   this.log(
    //     `Note: ${asm} has already been indexed with this configuration, use --force to overwrite this assembly. Skipping for now`,
    //   )
    //   continue
    // }
    // default settings
    const attrs = attributes || ['Name', 'ID']
    const excludeTypes = exclude || ['exon', 'CDS']
    // const force = true
    const quiet = true
    // supported tracks for given assembly
    const supportedTracks = tracks
      .filter(track => supported(track.adapter?.type))
      .filter(track => (asm ? track.assemblyNames.includes(asm) : true))

    console.log('supported', supportedTracks)
    await indexDriver(
      supportedTracks,
      outDir,
      attrs,
      asm,
      quiet,
      excludeTypes,
      [asm],
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
) {
  const readable = Readable.from(
    indexFiles(tracks, attributes, idxLocation, quiet, exclude),
  )
  const ixIxxStream = await runIxIxx(readable, idxLocation, name)
  await generateMeta({
    configs: tracks,
    attributes,
    outDir: idxLocation,
    name,
    exclude,
    assemblyNames,
  })
  return ixIxxStream
}

async function* indexFiles(
  tracks: Track[],
  attributes: string[],
  outLocation: string,
  quiet: boolean,
  typesToExclude: string[],
) {
  for (const track of tracks) {
    const { adapter, textSearching } = track
    const { type } = adapter
    const {
      indexingFeatureTypesToExclude: types = typesToExclude,
      indexingAttributes: attrs = attributes,
    } = textSearching || {}
    // currently only supporting GFF3Tabix and VCFTabix
    if (type === 'Gff3TabixAdapter') {
      yield* indexGff3(track, attrs, outLocation, types, quiet)
    } else if (type === 'VcfTabixAdapter') {
      yield* indexVcf(track, attrs, outLocation, types, quiet)
    }
  }
}

function runIxIxx(readStream: Readable, idxLocation: string, name: string) {
  const ixFilename = path.join(idxLocation, 'trix', `${name}.ix`)
  const ixxFilename = path.join(idxLocation, 'trix', `${name}.ixx`)
  return ixIxxStream(readStream, ixFilename, ixxFilename)
}
