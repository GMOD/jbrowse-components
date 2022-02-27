// import { AnyConfigurationModel } from '../configuration/configurationSchema'
import fs from 'fs'
import path from 'path'
import { Readable } from 'stream'
import { indexGff3 } from './types/gff3Adapter'
import { indexVcf } from './types/vcfAdapter'
import { generateMeta } from './types/common'
import { ixIxxStream } from 'ixixx'
import { Track } from './util'

export async function indexTracks(
  tracks: Track[],
  outLocation?: string,
  signal?: AbortSignal,
) {
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
  const attributes = ['Name', 'ID']
  const attrsExclude = ['exon', 'CDS']
  const assemblyNames = [] as string[]
  const nameOfIndex = 'test'
  await indexDriver(
    tracks,
    outDir,
    attributes,
    nameOfIndex,
    false,
    attrsExclude,
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
  const startTime = performance.now()
  const readable = Readable.from(
    indexFiles(tracks, attributes, idxLocation, quiet, exclude),
  )
  console.log('readable', readable)
  console.log('idxLocation', idxLocation)
  // idx location will be the output or temp directory
  await runIxIxx(readable, idxLocation, name)
  // console.log('ixIxxStream', ixIxxStream)
  const endTime = performance.now()
  console.log(`Indexing took ${endTime - startTime} milliseconds`)
  await generateMeta({
    configs: tracks,
    attributes,
    outDir: idxLocation,
    name,
    exclude,
    assemblyNames,
  })
  console.timeEnd('Indexing...')
  console.log("done generating meta")
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
