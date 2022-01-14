// import { AnyConfigurationModel } from '../configuration/configurationSchema'
import fs from 'fs'
import path from 'path'
import { cwd } from 'process'
// import { Readable } from 'stream'
import { indexGff3 } from './types/gff3Adapter'
import { indexVcf } from './types/vcfAdapter'
// import { ixIxxStream } from 'ixixx'
import { Track, Config } from './util'

function readConf(confFilePath: string) {
  return JSON.parse(fs.readFileSync(confFilePath, 'utf8')) as Config
}
export async function indexDriver(
  tracks: Track[],
  attributes?: string[],
  idxLocation?: string,
  name?: string,
  quiet?: boolean,
  exclude?: string[],
  assemblyNames?: string[],
) {
  //   const confLocation = idxLocation || '.'
  //   const isDir = fs.lstatSync(confLocation).isDirectory()
  //   const confPath = isDir ? path.join(cwd(), 'config.json') : confLocation
  const confPath = path.join(cwd(), 'JBrowse/config.json')

  const outDir = path.dirname(confPath)
  const config = readConf(confPath)

  console.log('output dir', outDir)
  //   console.log(`Current directory: ${confPath}`)
  const trixDir = path.join(outDir, 'trix')
  if (!fs.existsSync(trixDir)) {
    fs.mkdirSync(trixDir)
  }
  const aggregateAdapters = config.aggregateTextSearchAdapters || []
  const currentTracks = config.tracks || []
  console.log('current tracks', currentTracks)
  // TODO: create a readable
  //   const readable = Readable.from(
  //     indexFiles(
  //       currentTracks,
  //       attributes || [],
  //       outDir,
  //       quiet || true,
  //       exclude || [],
  //     ),
  //   )
  //   console.log('readable', readable)
  // TODO: create an ixIxxStream
  //   const ixIxxStream = await runIxIxx(readable, idxLocation || '', name || '')
  // TODO: we can create a metafile here
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

    if (type === 'Gff3TabixAdapter') {
      yield* indexGff3(track, attrs, outLocation, types, quiet)
    } else if (type === 'VcfTabixAdapter') {
      yield* indexVcf(track, attrs, outLocation, types, quiet)
    }

    // gtf unused currently
  }
}

// function runIxIxx(readStream: Readable, idxLocation: string, name: string) {
//   const ixFilename = path.join(idxLocation, 'trix', `${name}.ix`)
//   const ixxFilename = path.join(idxLocation, 'trix', `${name}.ixx`)

//   return ixIxxStream(readStream, ixFilename, ixxFilename)
// }
