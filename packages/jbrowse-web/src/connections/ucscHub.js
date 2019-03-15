import { GenomesFile, HubFile, TrackDbFile } from '@gmod/ucsc-hub'
// Polyfill for TextDecoder
import 'fast-text-encoding'
import { openLocation } from '../util/io'

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

export function generateTracks(trackDb, trackDbFileLocation) {
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
    tracks.push(makeTrackConfig(track, categories, trackDbFileLocation))
  })

  return tracks
}

function makeTrackConfig(track, categories, trackDbFileLocation) {
  const trackType = track.get('type')
  const baseTrackType = trackType.split(' ')[0]
  let bigDataUrl
  let bigDataIndex
  if (trackDbFileLocation.uri) {
    bigDataUrl = new URL(track.get('bigDataUrl'), trackDbFileLocation.uri)
    bigDataIndex =
      track.get('bigDataIndex') &&
      new URL(track.get('bigDataIndex'), trackDbFileLocation.uri)
  } else {
    bigDataUrl = track.get('bigDataUrl')
    bigDataIndex = track.get('bigDataIndex')
  }
  switch (baseTrackType) {
    case 'bam':
      return {
        type: 'AlignmentsTrack',
        name: track.get('shortLabel'),
        description: track.get('longLabel'),
        category: categories,
        adapter: {
          type: 'BamAdapter',
          bamLocation: { uri: bigDataUrl.href },
          index: {
            location: {
              uri: bigDataIndex ? bigDataIndex.href : `${bigDataUrl.href}.bai`,
            },
          },
        },
      }
    default:
      throw new Error(`Unsupported track type: ${baseTrackType}`)
  }
}
