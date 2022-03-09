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

// function readConf(confFilePath: string) {
//   return JSON.parse(fs.readFileSync(confFilePath, 'utf8')) as Config
// }
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
  console.log(idxType)
  if (idxType === 'perTrack') {
    await perTrackIndex(tracks, outLocation, attributes, assemblies, exclude)
  }
  //  else {
  //   await aggregateIndex(tracks, outLocation, attributes, assemblies, exclude)
  // }
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
  // check if track adapter is supported .filter(track => supported(track.adapter?.type))
  for (const trackConfig of tracks) {
    const { textSearching, trackId, assemblyNames } = trackConfig
    if (textSearching?.textSearchAdapter && !force) {
      console.warn(
        `Note: ${trackId} has already been indexed with this configuration, use --force to overwrite this track. Skipping for now`,
      )
      continue
    }
    // console.log('Indexing track ' + trackId + '...')

    // const id = trackId + '-index'
    await indexDriver(
      [trackConfig],
      outDir,
      attrs,
      trackId,
      true,
      excludeTypes,
      assemblyNames,
    )
    console.log('Done Indexing: ' + trackId)
    // if (!textSearching || !textSearching?.textSearchAdapter) {
    //   const newTrackConfig = {
    //     ...trackConfig,
    //     textSearching: {
    //       ...textSearching,
    //       textSearchAdapter: {
    //         type: 'TrixTextSearchAdapter',
    //         textSearchAdapterId: id,
    //         ixFilePath: {
    //           uri: `trix/${trackId}.ix`,
    //           locationType: 'UriLocation' as const,
    //         },
    //         ixxFilePath: {
    //           uri: `trix/${trackId}.ixx`,
    //           locationType: 'UriLocation' as const,
    //         },
    //         metaFilePath: {
    //           uri: `trix/${trackId}_meta.json`,
    //           locationType: 'UriLocation' as const,
    //         },
    //         assemblyNames: assemblyNames,
    //       },
    //     },
    //   }
    //   // modifies track with new text search adapter
    //   const index = configTracks.findIndex(track => trackId === track.trackId)
    //   configTracks[index] = newTrackConfig
    // }
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

// async function getTrackConfigs(
//   configPath: string,
//   trackIds?: string[],
//   assemblyName?: string,
// ) {
//   const { tracks } = readConf(configPath)
//   if (!tracks) {
//     return []
//   }
//   const trackIdsToIndex = trackIds || tracks?.map(track => track.trackId)
//   return trackIdsToIndex
//     .map(trackId => {
//       const currentTrack = tracks.find(t => trackId === t.trackId)
//       if (!currentTrack) {
//         throw new Error(
//           `Track not found in config.json for trackId ${trackId}, please add track configuration before indexing.`,
//         )
//       }
//       return currentTrack
//     })
//     .filter(track => supported(track.adapter?.type))
//     .filter(track =>
//       assemblyName ? track.assemblyNames.includes(assemblyName) : true,
//     )
// }
