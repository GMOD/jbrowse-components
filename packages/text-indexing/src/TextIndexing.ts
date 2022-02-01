// import { AnyConfigurationModel } from '../configuration/configurationSchema'
import fs from 'fs'
import path from 'path'
import { Readable } from 'stream'
import { indexGff3 } from './types/gff3Adapter'
import { indexVcf } from './types/vcfAdapter'
import { ixIxxStream } from 'ixixx'
import { Track, Config } from './util'

function readConf(confFilePath: string) {
  return JSON.parse(fs.readFileSync(confFilePath, 'utf8')) as Config
}

export async function indexTracks(
  rpcManager: any,
  track: Track,
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
  const outFlag = '.'

  const isDir = fs.lstatSync(outFlag).isDirectory()
  const confPath = isDir ? path.join(outFlag, 'JBrowse/config.json') : outFlag
  const outDir = path.dirname(confPath)
  const trixDir = path.join(outDir, 'trix')
  if (!fs.existsSync(trixDir)) {
    fs.mkdirSync(trixDir)
  }
  await indexDriver([track],[],trixDir)
  const test = await rpcManager.call(
    'indexTracksSessionId',
    'CoreIndexTracks',
    {
      trackConfigs: track,
      sessionId: 'indexTracksSessionId',
    },
  )
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
  const readable = Readable.from(
    indexFiles(
      tracks,
      attributes || [],
      idxLocation || '.',
      quiet || true,
      exclude || [],
    ),
  )
  console.log('readable', readable)
  // TODO: create an ixIxxStream
  const ixIxxStream = await runIxIxx(readable, idxLocation || '.', name || 'test')
  // TODO: we can create a metafile here
  console.log('ixixx', ixIxxStream)
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
  const ixFilename = path.join(idxLocation, `${name}.ix`)
  const ixxFilename = path.join(idxLocation, `${name}.ixx`)

  return ixIxxStream(readStream, ixFilename, ixxFilename)
}
