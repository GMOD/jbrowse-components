// import { AnyConfigurationModel } from '../configuration/configurationSchema'
import fs from 'fs'
import path from 'path'
import { Readable } from 'stream'
import { indexGff3 } from './types/gff3Adapter'
import { indexVcf } from './types/vcfAdapter'
import { generateMeta } from './types/common'
import { ixIxxStream } from 'ixixx'
import { Track } from './util'

type indexType = 'aggregate' | 'perTrack'
export async function indexTracks(args: {
  tracks: Track[]
  outLocation?: string
  signal?: AbortSignal
  attributes?: string[]
  assemblies?: string[]
  exclude?: string[]
  indexType?: indexType
}) {
  const { tracks, outLocation, attributes, exclude, assemblies, indexType } =
    args
  console.time('Indexing...')
  const outFlag = outLocation || '.'
  const isDir = fs.lstatSync(outFlag).isDirectory()
  const confPath = isDir ? path.join(outFlag, 'JBrowse/config.json') : outFlag
  const outDir = path.dirname(confPath)
  const trixDir = path.join(outDir, 'trix')
  if (!fs.existsSync(trixDir)) {
    fs.mkdirSync(trixDir)
  }
  // default settings
  const idxType = indexType || 'perTrack'
  console.log(idxType)
  const attrs = attributes || ['Name', 'ID']
  const excludeTypes = exclude || ['exon', 'CDS']
  const assemblyNames = assemblies || []
  const nameOfIndex = 'test'
  await indexDriver(
    tracks,
    outDir,
    attrs,
    nameOfIndex,
    false,
    excludeTypes,
    assemblyNames,
  )
  return []
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
  // const startTime = performance.now()
  const readable = Readable.from(
    indexFiles(tracks, attributes, idxLocation, quiet, exclude),
  )
  // console.log("Indexing begins...")
  // console.log('readable', readable)
  // console.log('idxLocation', idxLocation)
  // idx location will be the output or temp directory
  await runIxIxx(readable, idxLocation, name)
  // console.log('ixIxxStream', ixIxxStream)
  // const endTime = performance.now()
  // console.log(`Indexing took ${endTime - startTime} milliseconds`)
  console.log('Generating metadata...')
  await generateMeta({
    configs: tracks,
    attributes,
    outDir: idxLocation,
    name,
    exclude,
    assemblyNames,
  })
  // console.log('Indexing completed.')
  return
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
