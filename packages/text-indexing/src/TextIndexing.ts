// import { AnyConfigurationModel } from '../configuration/configurationSchema'
import fs from 'fs'
import path from 'path'
import { cwd } from 'process'
import { Readable } from 'stream'
import { indexGff3 } from './types/gff3Adapter'
import { indexVcf } from './types/vcfAdapter'
import { ixIxxStream } from 'ixixx'
import { Track, Config } from './util'

function readConf(confFilePath: string) {
  return JSON.parse(fs.readFileSync(confFilePath, 'utf8')) as Config
}

// TODO: implement Text background indexer class
// 1) detect changes in the config
// 2) determine wether to index changes or not
// 3) index changes in a separate thread
//    create a temp dir to store index
// export class Jobs {
//   param: number
//   constructor(param: number) {
//     // add a queue here to handle job requests
//     // keep the state of the jobs
//     this.param = param
//     console.log(param)
//   }
//   // we can have a way to detect type of job
//   // for our case we would want an indexing job
//   // handle aborting jobs
//   cancelJob() {
//     // will use abort signals to cancel jobs
//     // if a job is cancelled, do not create another one unitl JBrowse restarts
//     console.log('handling error...')
//   }

//   runJob() {
//     console.log('running the job in another thread')
//   }
//   // provide progress updates from workers
//   provideStatus() {
//     console.log('this is the status of the worker')
//   }
// }
export function indexTracks(
  // model: LGV,
  tracks: Track[],
  signal?: AbortSignal,
) {
  // const session = getSession(model)
  // const { rpcManager, assemblyManager } = session
  // get assembly name
  // const assembly = assemblyManager.get(assemblyName)
  // if (!assembly) {
  //   throw new Error(`assembly ${assemblyName} not found`)
  // }
  // const adapterConfig = getConf(assembly, ['sequence', 'adapter'])

  // const sessionId = 'indexTracks'
  // await rpcManager.call(sessionId, 'CoreIndexTracks', {
  //   // adapterConfig,
  //   tracks,
  //   sessionId,
  //   signal,
  // })
  // assumes that we get whole sequence in a single getFeatures call
  return []
}
async function indexDriver(
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

  // console.log('output dir', outDir)
  //   console.log(`Current directory: ${confPath}`)
  const trixDir = path.join(outDir, 'trix')
  if (!fs.existsSync(trixDir)) {
    fs.mkdirSync(trixDir)
  }
  const aggregateAdapters = config.aggregateTextSearchAdapters || []
  const currentTracks = config.tracks || []
  console.log('current tracks', currentTracks)
  // TODO: create a readable
  const readable = Readable.from(
    indexFiles(
      currentTracks,
      attributes || [],
      outDir,
      quiet || true,
      exclude || [],
    ),
  )
  console.log('readable', readable)
  // TODO: create an ixIxxStream
  const ixIxxStream = await runIxIxx(readable, idxLocation || '', name || '')
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

function runIxIxx(readStream: Readable, idxLocation: string, name: string) {
  const ixFilename = path.join(idxLocation, 'trix', `${name}.ix`)
  const ixxFilename = path.join(idxLocation, 'trix', `${name}.ixx`)

  return ixIxxStream(readStream, ixFilename, ixxFilename)
}
