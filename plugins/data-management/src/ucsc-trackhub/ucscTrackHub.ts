/* eslint-disable @typescript-eslint/no-explicit-any */
import { RaStanza, TrackDbFile } from '@gmod/ucsc-hub'
import { FileLocation, isUriLocation, objectHash } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import {
  generateUnsupportedTrackConf,
  generateUnknownTrackConf,
} from '@jbrowse/core/util/tracks'

export async function fetchHubFile(hubLocation: FileLocation) {
  try {
    const hubFileText = await openLocation(hubLocation).readFile('utf8')
    const { HubFile } = await import('@gmod/ucsc-hub')
    return new HubFile(hubFileText)
  } catch (error) {
    throw new Error(`Not a valid hub.txt file, got error: '${error}'`)
  }
}

export async function fetchGenomesFile(genomesLoc: FileLocation) {
  const genomesFileText = await openLocation(genomesLoc).readFile('utf8')
  const { GenomesFile } = await import('@gmod/ucsc-hub')
  return new GenomesFile(genomesFileText)
}

export async function fetchTrackDbFile(trackDbLoc: FileLocation) {
  const text = await openLocation(trackDbLoc).readFile('utf8')
  const { TrackDbFile } = await import('@gmod/ucsc-hub')
  return new TrackDbFile(text)
}

export function makeLoc(first: string, base: { uri: string }) {
  return {
    uri: new URL(first, base.uri).href,
    locationType: 'UriLocation',
  }
}

export function makeLocAlt(first: string, alt: string, base: { uri: string }) {
  return first ? makeLoc(first, base) : makeLoc(alt, base)
}

export function makeLoc2(first: string, alt?: string) {
  return first
    ? {
        uri: first,
        locationType: 'LocalPath',
      }
    : {
        uri: alt,
        locationType: 'UriLocation',
      }
}

export function generateTracks(
  trackDb: TrackDbFile,
  trackDbLoc: FileLocation,
  assemblyName: string,
  sequenceAdapter: any,
) {
  const tracks: any = []

  for (const [trackName, track] of trackDb.entries()) {
    const trackKeys = [...track.keys()]
    const parentTrackKeys = new Set([
      'superTrack',
      'compositeTrack',
      'container',
      'view',
    ])
    if (trackKeys.some(key => parentTrackKeys.has(key))) {
      continue
    }
    const parentTracks = []
    let currentTrackName = trackName
    do {
      currentTrackName = trackDb.get(currentTrackName)?.get('parent') || ''
      if (currentTrackName) {
        ;[currentTrackName] = currentTrackName.split(' ')
        parentTracks.push(trackDb.get(currentTrackName))
      }
    } while (currentTrackName)
    parentTracks.reverse()
    const categories = parentTracks
      .map(p => p?.get('shortLabel'))
      .filter((f): f is string => !!f)
    const res = makeTrackConfig(
      track,
      categories,
      trackDbLoc,
      trackDb,
      sequenceAdapter,
    )
    tracks.push({
      ...res,
      trackId: `ucsc-trackhub-${objectHash(res)}`,
      assemblyNames: [assemblyName],
    })
  }

  return tracks
}

function makeTrackConfig(
  track: RaStanza,
  categories: string[],
  trackDbLoc: FileLocation,
  trackDb: TrackDbFile,
  sequenceAdapter: any,
) {
  let trackType = track.get('type')
  const name = track.get('shortLabel') || ''
  const bigDataUrl = track.get('bigDataUrl') || ''
  const bigDataIdx = track.get('bigDataIndex') || ''
  const isUri = isUriLocation(trackDbLoc)
  if (!trackType) {
    trackType = trackDb.get(track.get('parent') || '')?.get('type')
  }
  let baseTrackType = trackType?.split(' ')[0] || ''
  if (baseTrackType === 'bam' && bigDataUrl.toLowerCase().endsWith('cram')) {
    baseTrackType = 'cram'
  }
  const bigDataLocation = isUri
    ? makeLoc(bigDataUrl, trackDbLoc)
    : makeLoc2(bigDataUrl)

  switch (baseTrackType) {
    case 'bam':
      return {
        type: 'AlignmentsTrack',
        name: track.get('shortLabel'),
        description: track.get('longLabel'),
        category: categories,
        adapter: {
          type: 'BamAdapter',
          bamLocation: bigDataLocation,
          index: {
            location: isUri
              ? makeLocAlt(bigDataIdx, bigDataUrl + '.bai', trackDbLoc)
              : makeLoc2(bigDataIdx, bigDataUrl + '.bai'),
          },
        },
      }

    case 'bigBarChart':
      return {
        type: 'FeatureTrack',
        name,
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
        name,
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
        name,
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
        name,
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
        name,
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
        name,
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
        name,
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
        name,
        description: track.get('longLabel'),
        category: categories,
        adapter: {
          type: 'BigWigAdapter',
          bigWigLocation: bigDataLocation,
        },
      }

    case 'cram':
      return {
        type: 'AlignmentsTrack',
        name,
        description: track.get('longLabel'),
        category: categories,
        adapter: {
          type: 'CramAdapter',
          cramLocation: bigDataLocation,
          craiLocation: isUri
            ? makeLocAlt(bigDataIdx, bigDataUrl + '.crai', trackDbLoc)
            : makeLoc2(bigDataIdx, bigDataUrl + '.crai'),
          sequenceAdapter,
        },
      }

    case 'bigNarrowPeak':
      return {
        type: 'FeatureTrack',
        name,
        description: track.get('longLabel'),
        category: categories,
        adapter: {
          type: 'BigBedAdapter',
          bigBedLocation: bigDataLocation,
        },
      }
    case 'peptideMapping':
      return generateUnsupportedTrackConf(name, baseTrackType, categories)
    case 'vcfTabix':
      return {
        type: 'VariantTrack',
        name,
        description: track.get('longLabel'),
        category: categories,
        adapter: {
          type: 'VcfTabixAdapter',
          vcfGzLocation: bigDataLocation,
          index: {
            location: isUri
              ? makeLocAlt(bigDataIdx, bigDataUrl + '.tbi', trackDbLoc)
              : makeLoc2(bigDataIdx, bigDataUrl + '.tbi'),
          },
        },
      }

    case 'hic':
      return {
        type: 'HicTrack',
        name,
        description: track.get('longLabel'),
        category: categories,
        adapter: {
          type: 'HicAdapter',
          hicLocation: bigDataLocation,
        },
      }

    // unsupported types
    //     case 'gvf':
    //     case 'ld2':
    //     case 'narrowPeak':
    //     case 'wig':
    //     case 'wigMaf':
    //     case 'halSnake':
    //     case 'bed':
    //     case 'bed5FloatScore':
    //     case 'bedGraph':
    //     case 'bedRnaElements':
    //     case 'broadPeak':
    //     case 'coloredExon':
    default:
      return generateUnknownTrackConf(name, baseTrackType, categories)
  }
}

export { default as ucscAssemblies } from './ucscAssemblies'
