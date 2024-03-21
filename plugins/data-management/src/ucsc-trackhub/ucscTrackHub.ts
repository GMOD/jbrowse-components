/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  FileLocation,
  isUriLocation,
  notEmpty,
  objectHash,
} from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { generateUnknownTrackConf } from '@jbrowse/core/util/tracks'
import { RaStanza, GenomesFile, TrackDbFile } from '@gmod/ucsc-hub'

export async function fetchGenomesFile(genomesLoc: FileLocation) {
  const genomesFileText = await openLocation(genomesLoc).readFile('utf8')
  return new GenomesFile(genomesFileText)
}

export async function fetchTrackDbFile(trackDbLoc: FileLocation) {
  const text = await openLocation(trackDbLoc).readFile('utf8')
  return new TrackDbFile(text)
}

export function makeLoc(
  first: string,
  base: { uri: string; baseUri?: string },
) {
  return {
    locationType: 'UriLocation',
    uri: new URL(first, new URL(base.uri, base.baseUri)).href,
  }
}

export function makeLocAlt(first: string, alt: string, base: { uri: string }) {
  return first ? makeLoc(first, base) : makeLoc(alt, base)
}

export function makeLoc2(first: string, alt?: string) {
  return first
    ? {
        locationType: 'LocalPath',
        uri: first,
      }
    : {
        locationType: 'UriLocation',
        uri: alt,
      }
}

export function generateTracks({
  trackDb,
  trackDbLoc,
  assemblyName,
  sequenceAdapter,
}: {
  trackDb: TrackDbFile
  trackDbLoc: FileLocation
  assemblyName: string
  sequenceAdapter: any
}) {
  return Object.entries(trackDb.data)
    .map(([trackName, track]) => {
      const trackKeys = Object.keys(track!)
      const parentTrackKeys = new Set([
        'superTrack',
        'compositeTrack',
        'container',
        'view',
      ])
      if (trackKeys.some(key => parentTrackKeys.has(key))) {
        return undefined
      }
      const parentTracks = []
      let currentTrackName = trackName
      do {
        currentTrackName = trackDb.data[currentTrackName]?.data.parent || ''
        if (currentTrackName) {
          ;[currentTrackName] = currentTrackName.split(' ')
          parentTracks.push(trackDb.data[currentTrackName])
        }
      } while (currentTrackName)
      parentTracks.reverse()
      const categories = parentTracks
        .map(p => p?.data.shortLabel)
        .filter((f): f is string => !!f)
      const res = makeTrackConfig({
        categories,
        sequenceAdapter,
        track: track!,
        trackDb,
        trackDbLoc,
      })
      return {
        ...res,
        assemblyNames: [assemblyName],
        trackId: `ucsc-trackhub-${objectHash(res)}`,
      }
    })
    .filter(notEmpty)
}

function makeTrackConfig({
  track,
  categories,
  trackDbLoc,
  trackDb,
  sequenceAdapter,
}: {
  track: RaStanza
  categories: string[]
  trackDbLoc: FileLocation
  trackDb: TrackDbFile
  sequenceAdapter: any
}) {
  const trackType =
    track.data.type || trackDb.data[track.data.parent || '']?.data.type || ''
  const name = track.data.shortLabel || ''
  const bigDataUrl = track.data.bigDataUrl || ''
  const bigDataIdx = track.data.bigDataIndex || ''
  const isUri = isUriLocation(trackDbLoc)
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
        adapter: {
          bamLocation: bigDataLocation,
          index: {
            location: isUri
              ? makeLocAlt(bigDataIdx, bigDataUrl + '.bai', trackDbLoc)
              : makeLoc2(bigDataIdx, bigDataUrl + '.bai'),
          },
          type: 'BamAdapter',
        },
        category: categories,
        description: track.data.longLabel,
        name: track.data.longLabel,
        type: 'AlignmentsTrack',
      }

    case 'cram':
      return {
        adapter: {
          craiLocation: isUri
            ? makeLocAlt(bigDataIdx, bigDataUrl + '.crai', trackDbLoc)
            : makeLoc2(bigDataIdx, bigDataUrl + '.crai'),
          cramLocation: bigDataLocation,
          sequenceAdapter,
          type: 'CramAdapter',
        },
        category: categories,
        description: track.data.longLabel,
        name,
        type: 'AlignmentsTrack',
      }
    case 'bigBarChart':
    case 'bigBed':
    case 'bigGenePred':
    case 'bigChain':
    case 'bigInteract':
    case 'bigMaf':
    case 'bigNarrowPeak':
    case 'bigPsl':
      return {
        adapter: {
          bigBedLocation: bigDataLocation,
          type: 'BigBedAdapter',
        },
        category: categories,
        description: track.data.longLabel,
        name,
        type: 'FeatureTrack',
      }
    case 'bigWig':
      return {
        adapter: {
          bigWigLocation: bigDataLocation,
          type: 'BigWigAdapter',
        },
        category: categories,
        description: track.data.longLabel,
        name,
        type: 'QuantitativeTrack',
      }

    case 'vcfTabix':
      return {
        adapter: {
          index: {
            location: isUri
              ? makeLocAlt(bigDataIdx, bigDataUrl + '.tbi', trackDbLoc)
              : makeLoc2(bigDataIdx, bigDataUrl + '.tbi'),
          },
          type: 'VcfTabixAdapter',
          vcfGzLocation: bigDataLocation,
        },
        category: categories,
        description: track.data.longLabel,
        name,
        type: 'VariantTrack',
      }

    case 'hic':
      return {
        adapter: {
          hicLocation: bigDataLocation,
          type: 'HicAdapter',
        },
        category: categories,
        description: track.data.longLabel,
        name,
        type: 'HicTrack',
      }

    // unsupported types
    //     case 'peptideMapping':
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
