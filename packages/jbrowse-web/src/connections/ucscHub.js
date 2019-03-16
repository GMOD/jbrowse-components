import { GenomesFile, HubFile, TrackDbFile } from '@gmod/ucsc-hub'
// Polyfill for TextDecoder
import 'fast-text-encoding'
import { openLocation } from '../util/io'
import ucscAssemblies from './ucscAssemblies'

export { ucscAssemblies }

export async function fetchHubFile(hubFileLocation) {
  const hubFileText = new TextDecoder('utf-8').decode(
    await openLocation(hubFileLocation).readFile(),
  )
  return new HubFile(hubFileText)
}

export async function fetchGenomesFile(genomesFileLocation) {
  const genomesFileText = new TextDecoder('utf-8').decode(
    await openLocation(genomesFileLocation).readFile(),
  )
  return new GenomesFile(genomesFileText)
}

export async function fetchTrackDbFile(trackDbFileLocation) {
  const trackDbFileText = new TextDecoder('utf-8').decode(
    await openLocation(trackDbFileLocation).readFile(),
  )
  return new TrackDbFile(trackDbFileText)
}

export function generateTracks(
  trackDb,
  trackDbFileLocation,
  assemblyName = undefined,
) {
  const tracks = []

  trackDb.forEach((track, trackName) => {
    const trackKeys = Array.from(track.keys())
    const parentTrackKeys = [
      'superTrack',
      'compositeTrack',
      'container',
      'view',
    ]
    if (trackKeys.some(key => parentTrackKeys.includes(key))) return
    const parentTracks = []
    let currentTrackName = trackName
    do {
      currentTrackName = trackDb.get(currentTrackName).get('parent')
      if (currentTrackName) {
        ;[currentTrackName] = currentTrackName.split(' ')
        parentTracks.push(trackDb.get(currentTrackName).get('shortLabel'))
      }
    } while (currentTrackName)
    parentTracks.reverse()
    const categories = [].concat(parentTracks)
    tracks.push(
      makeTrackConfig(track, categories, trackDbFileLocation, assemblyName),
    )
  })

  return tracks
}

function makeTrackConfig(
  track,
  categories,
  trackDbFileLocation,
  assemblyName = undefined,
) {
  const trackType = track.get('type')
  let baseTrackType = trackType.split(' ')[0]
  if (
    baseTrackType === 'bam' &&
    track
      .get('bigDataUrl')
      .toLowerCase()
      .endsWith('cram')
  )
    baseTrackType = 'cram'
  let bigDataLocation
  if (trackDbFileLocation.uri)
    bigDataLocation = {
      uri: new URL(track.get('bigDataUrl'), trackDbFileLocation.uri).href,
    }
  else bigDataLocation = { localPath: track.get('bigDataUrl') }
  let bigDataIndexLocation
  switch (baseTrackType) {
    case 'bam':
      if (trackDbFileLocation.uri)
        bigDataIndexLocation = track.get('bigDataIndex')
          ? {
              uri: new URL(track.get('bigDataIndex'), trackDbFileLocation.uri)
                .href,
            }
          : {
              uri: new URL(
                `${track.get('bigDataUrl')}.bai`,
                trackDbFileLocation.uri,
              ).href,
            }
      else
        bigDataIndexLocation = track.get('bigDataIndex')
          ? { localPath: track.get('bigDataIndex') }
          : { localPath: `${track.get('bigDataUrl')}.bai` }
      return {
        type: 'AlignmentsTrack',
        name: track.get('shortLabel'),
        description: track.get('longLabel'),
        category: categories,
        assemblyName,
        adapter: {
          type: 'BamAdapter',
          bamLocation: bigDataLocation,
          index: {
            location: bigDataIndexLocation,
          },
        },
      }
    case 'bed':
      return generateUnsupportedTrackConf(track, categories, baseTrackType)
    case 'bed5FloatScore':
      return generateUnsupportedTrackConf(track, categories, baseTrackType)
    case 'bedGraph':
      return generateUnsupportedTrackConf(track, categories, baseTrackType)
    case 'bedRnaElements':
      return generateUnsupportedTrackConf(track, categories, baseTrackType)
    case 'bigBarChart':
      return generateUnsupportedTrackConf(track, categories, baseTrackType)
    case 'bigBed':
      return generateUnsupportedTrackConf(track, categories, baseTrackType)
    case 'bigChain':
      return generateUnsupportedTrackConf(track, categories, baseTrackType)
    case 'bigInteract':
      return generateUnsupportedTrackConf(track, categories, baseTrackType)
    case 'bigMaf':
      return generateUnsupportedTrackConf(track, categories, baseTrackType)
    case 'bigPsl':
      return generateUnsupportedTrackConf(track, categories, baseTrackType)
    case 'bigWig':
      return {
        type: 'BasicTrack',
        name: track.get('shortLabel'),
        description: track.get('longLabel'),
        category: categories,
        renderer: { type: 'WiggleRenderer' },
        assemblyName,
        adapter: {
          type: 'BigWigAdapter',
          bigWigLocation: bigDataLocation,
        },
      }
    case 'broadPeak':
      return generateUnsupportedTrackConf(track, categories, baseTrackType)
    case 'coloredExon':
      return generateUnsupportedTrackConf(track, categories, baseTrackType)
    case 'cram':
      return generateUnsupportedTrackConf(track, categories, baseTrackType)
    case 'gvf':
      return generateUnsupportedTrackConf(track, categories, baseTrackType)
    case 'ld2':
      return generateUnsupportedTrackConf(track, categories, baseTrackType)
    case 'narrowPeak':
      return generateUnsupportedTrackConf(track, categories, baseTrackType)
    case 'peptideMapping':
      return generateUnsupportedTrackConf(track, categories, baseTrackType)
    case 'vcfTabix':
      return generateUnsupportedTrackConf(track, categories, baseTrackType)
    case 'wig':
      return generateUnsupportedTrackConf(track, categories, baseTrackType)
    case 'wigMaf':
      return generateUnsupportedTrackConf(track, categories, baseTrackType)
    default:
      throw new Error(`Unsupported track type: ${baseTrackType}`)
  }
}

function generateUnsupportedTrackConf(track, categories, baseTrackType) {
  return {
    type: 'BasicTrack',
    name: `${track.get('shortLabel')} (Unsupported)`,
    description: `Support for track type "${baseTrackType}" has not been implemented yet`,
    category: categories,
  }
}
