import { objectHash } from '@jbrowse/core/util'
import { GenomesFile, HubFile, TrackDbFile } from '@gmod/ucsc-hub'
import { openLocation } from '@jbrowse/core/util/io'
import {
  generateUnsupportedTrackConf,
  generateUnknownTrackConf,
} from '@jbrowse/core/util/tracks'
import ucscAssemblies from './ucscAssemblies'

export { ucscAssemblies }

export async function fetchHubFile(hubFileLocation) {
  try {
    const hubFileText = await openLocation(hubFileLocation).readFile('utf8')
    return new HubFile(hubFileText)
  } catch (error) {
    throw new Error(`Not a valid hub.txt file, got error: '${error}'`)
  }
}

export async function fetchGenomesFile(genomesFileLocation) {
  const genomesFileText = await openLocation(genomesFileLocation).readFile(
    'utf8',
  )
  return new GenomesFile(genomesFileText)
}

export async function fetchTrackDbFile(trackDbFileLocation) {
  const trackDbFileText = await openLocation(trackDbFileLocation).readFile(
    'utf8',
  )
  return new TrackDbFile(trackDbFileText)
}

export function generateTracks(
  trackDb,
  trackDbFileLocation,
  assemblyName,
  sequenceAdapter,
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
    if (trackKeys.some(key => parentTrackKeys.includes(key))) {
      return
    }
    const parentTracks = []
    let currentTrackName = trackName
    do {
      currentTrackName = trackDb.get(currentTrackName).get('parent')
      if (currentTrackName) {
        ;[currentTrackName] = currentTrackName.split(' ')
        parentTracks.push(trackDb.get(currentTrackName))
      }
    } while (currentTrackName)
    parentTracks.reverse()
    const categories = parentTracks.map(parentTrack =>
      parentTrack.get('shortLabel'),
    )
    const res = makeTrackConfig(
      track,
      categories,
      trackDbFileLocation,
      trackDb,
      sequenceAdapter,
    )
    res.trackId = `ucsc-trackhub-${objectHash(res)}`
    res.assemblyNames = [assemblyName]
    tracks.push(res)
  })

  return tracks
}

function makeTrackConfig(
  track,
  categories,
  trackDbFileLocation,
  trackDb,
  sequenceAdapter,
) {
  let trackType = track.get('type')
  if (!trackType) {
    trackType = trackDb.get(track.get('parent')).get('type')
  }
  let baseTrackType = trackType.split(' ')[0]
  if (
    baseTrackType === 'bam' &&
    track.get('bigDataUrl').toLowerCase().endsWith('cram')
  ) {
    baseTrackType = 'cram'
  }
  let bigDataLocation
  if (trackDbFileLocation.uri) {
    bigDataLocation = {
      uri: new URL(track.get('bigDataUrl'), trackDbFileLocation.uri).href,
    }
  } else {
    bigDataLocation = { localPath: track.get('bigDataUrl') }
  }
  let bigDataIndexLocation

  switch (baseTrackType) {
    case 'bam':
      if (trackDbFileLocation.uri) {
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
      } else {
        bigDataIndexLocation = track.get('bigDataIndex')
          ? { localPath: track.get('bigDataIndex') }
          : { localPath: `${track.get('bigDataUrl')}.bai` }
      }
      return {
        type: 'AlignmentsTrack',
        name: track.get('shortLabel'),
        description: track.get('longLabel'),
        category: categories,
        adapter: {
          type: 'BamAdapter',
          bamLocation: bigDataLocation,
          index: {
            location: bigDataIndexLocation,
          },
        },
      }
    case 'bed':
      return generateUnsupportedTrackConf(
        track.get('shortLabel'),
        baseTrackType,
        categories,
      )
    case 'bed5FloatScore':
      return generateUnsupportedTrackConf(
        track.get('shortLabel'),
        baseTrackType,
        categories,
      )
    case 'bedGraph':
      return generateUnsupportedTrackConf(
        track.get('shortLabel'),
        baseTrackType,
        categories,
      )
    case 'bedRnaElements':
      return generateUnsupportedTrackConf(
        track.get('shortLabel'),
        baseTrackType,
        categories,
      )
    case 'bigBarChart':
      return {
        type: 'FeatureTrack',
        name: track.get('shortLabel'),
        description: track.get('longLabel'),
        category: categories,
        adapter: {
          type: 'BigBedAdapter',
          bigBedLocation: bigDataLocation,
        },
        renderer: {
          type: 'SvgFeatureRenderer',
        },
      }
    case 'bigBed':
      return {
        type: 'FeatureTrack',
        name: track.get('shortLabel'),
        description: track.get('longLabel'),
        category: categories,
        adapter: {
          type: 'BigBedAdapter',
          bigBedLocation: bigDataLocation,
        },
      }
    case 'bigGenePred':
      return {
        type: 'FeatureTrack',
        name: track.get('shortLabel'),
        description: track.get('longLabel'),
        category: categories,
        adapter: {
          type: 'BigBedAdapter',
          bigBedLocation: bigDataLocation,
        },
      }
    case 'bigChain':
      return {
        type: 'FeatureTrack',
        name: track.get('shortLabel'),
        description: track.get('longLabel'),
        category: categories,
        adapter: {
          type: 'BigBedAdapter',
          bigBedLocation: bigDataLocation,
        },
        renderer: {
          type: 'SvgFeatureRenderer',
        },
      }
    case 'bigInteract':
      return {
        type: 'FeatureTrack',
        name: track.get('shortLabel'),
        description: track.get('longLabel'),
        category: categories,
        adapter: {
          type: 'BigBedAdapter',
          bigBedLocation: bigDataLocation,
        },
        renderer: {
          type: 'SvgFeatureRenderer',
        },
      }
    case 'bigMaf':
      return {
        type: 'FeatureTrack',
        name: track.get('shortLabel'),
        description: track.get('longLabel'),
        category: categories,
        adapter: {
          type: 'BigBedAdapter',
          bigBedLocation: bigDataLocation,
        },
        renderer: {
          type: 'SvgFeatureRenderer',
        },
      }
    case 'bigPsl':
      return {
        type: 'FeatureTrack',
        name: track.get('shortLabel'),
        description: track.get('longLabel'),
        category: categories,
        adapter: {
          type: 'BigBedAdapter',
          bigBedLocation: bigDataLocation,
        },
        renderer: {
          type: 'SvgFeatureRenderer',
        },
      }
    case 'bigWig':
      return {
        type: 'QuantitativeTrack',
        name: track.get('shortLabel'),
        description: track.get('longLabel'),
        category: categories,
        adapter: {
          type: 'BigWigAdapter',
          bigWigLocation: bigDataLocation,
        },
      }
    case 'broadPeak':
      return generateUnsupportedTrackConf(
        track.get('shortLabel'),
        baseTrackType,
        categories,
      )
    case 'coloredExon':
      return generateUnsupportedTrackConf(
        track.get('shortLabel'),
        baseTrackType,
        categories,
      )
    case 'cram':
      if (trackDbFileLocation.uri) {
        bigDataIndexLocation = track.get('bigDataIndex')
          ? {
              uri: new URL(track.get('bigDataIndex'), trackDbFileLocation.uri)
                .href,
            }
          : {
              uri: new URL(
                `${track.get('bigDataUrl')}.crai`,
                trackDbFileLocation.uri,
              ).href,
            }
      } else {
        bigDataIndexLocation = track.get('bigDataIndex')
          ? { localPath: track.get('bigDataIndex') }
          : { localPath: `${track.get('bigDataUrl')}.crai` }
      }
      return {
        type: 'AlignmentsTrack',
        name: track.get('shortLabel'),
        description: track.get('longLabel'),
        category: categories,
        adapter: {
          type: 'CramAdapter',
          cramLocation: bigDataLocation,
          craiLocation: bigDataIndexLocation,
          sequenceAdapter,
        },
      }
    case 'gvf':
      return generateUnsupportedTrackConf(
        track.get('shortLabel'),
        baseTrackType,
        categories,
      )
    case 'ld2':
      return generateUnsupportedTrackConf(
        track.get('shortLabel'),
        baseTrackType,
        categories,
      )
    case 'narrowPeak':
      return generateUnsupportedTrackConf(
        track.get('shortLabel'),
        baseTrackType,
        categories,
      )
    case 'bigNarrowPeak':
      return {
        type: 'FeatureTrack',
        name: track.get('shortLabel'),
        description: track.get('longLabel'),
        category: categories,
        adapter: {
          type: 'BigBedAdapter',
          bigBedLocation: bigDataLocation,
        },
      }
    case 'peptideMapping':
      return generateUnsupportedTrackConf(
        track.get('shortLabel'),
        baseTrackType,
        categories,
      )
    case 'vcfTabix':
      if (trackDbFileLocation.uri) {
        bigDataIndexLocation = track.get('bigDataIndex')
          ? {
              uri: new URL(track.get('bigDataIndex'), trackDbFileLocation.uri)
                .href,
            }
          : {
              uri: new URL(
                `${track.get('bigDataUrl')}.tbi`,
                trackDbFileLocation.uri,
              ).href,
            }
      } else {
        bigDataIndexLocation = track.get('bigDataIndex')
          ? { localPath: track.get('bigDataIndex') }
          : { localPath: `${track.get('bigDataUrl')}.tbi` }
      }
      return {
        type: 'VariantTrack',
        name: track.get('shortLabel'),
        description: track.get('longLabel'),
        category: categories,
        adapter: {
          type: 'VcfTabixAdapter',
          vcfGzLocation: bigDataLocation,
          index: {
            location: bigDataIndexLocation,
          },
        },
      }
    case 'wig':
      return generateUnsupportedTrackConf(
        track.get('shortLabel'),
        baseTrackType,
        categories,
      )
    case 'wigMaf':
      return generateUnsupportedTrackConf(
        track.get('shortLabel'),
        baseTrackType,
        categories,
      )
    case 'hic':
      return {
        type: 'HicTrack',
        name: track.get('shortLabel'),
        description: track.get('longLabel'),
        category: categories,
        adapter: {
          type: 'HicAdapter',
          hicLocation: bigDataLocation,
        },
      }
    case 'halSnake':
      return generateUnsupportedTrackConf(
        track.get('shortLabel'),
        baseTrackType,
        categories,
      )

    default:
      return generateUnknownTrackConf(
        track.get('shortLabel'),
        baseTrackType,
        categories,
      )
  }
}
