import { GenomesFile, TrackDbFile } from '@gmod/ucsc-hub'
import { isUriLocation, notEmpty, objectHash } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { generateUnknownTrackConf } from '@jbrowse/core/util/tracks'

import type { RaStanza } from '@gmod/ucsc-hub'
import type { FileLocation } from '@jbrowse/core/util'

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
    uri: new URL(first, new URL(base.uri, base.baseUri)).href,
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
  const parentTrackKeys = new Set([
    'superTrack',
    'compositeTrack',
    'container',
    'view',
  ])
  return Object.entries(trackDb.data)
    .map(([trackName, track]) => {
      const { data } = track
      if (Object.keys(data).some(key => parentTrackKeys.has(key))) {
        return undefined
      } else {
        const parentTracks = []
        let currentTrackName = trackName
        do {
          currentTrackName = trackDb.data[currentTrackName]?.data.parent || ''
          if (currentTrackName) {
            currentTrackName = currentTrackName.split(' ')[0]!
            parentTracks.push(trackDb.data[currentTrackName])
          }
        } while (currentTrackName)
        parentTracks.reverse()
        const categories = parentTracks
          .map(p => p?.data.shortLabel)
          .filter((f): f is string => !!f)
        const res = makeTrackConfig({
          track,
          categories,
          trackDbLoc,
          trackDb,
          sequenceAdapter,
        })
        return {
          ...res,
          trackId: `ucsc-trackhub-${objectHash(res)}`,
          assemblyNames: [assemblyName],
        }
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
  const { data } = track

  const parent = data.parent || ''
  const bigDataUrl = data.bigDataUrl || ''
  const bigDataIdx = data.bigDataIndex || ''
  const trackType = data.type || trackDb.data[parent]?.data.type || ''
  const name =
    (data.shortLabel || '') + (bigDataUrl.includes('xeno') ? ' (xeno)' : '')

  const isUri = isUriLocation(trackDbLoc)
  let baseTrackType = trackType.split(' ')[0] || ''
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
        name,
        description: data.longLabel,
        category: categories,
        adapter: {
          type: 'BamAdapter',
          bamLocation: bigDataLocation,
          index: {
            location: isUri
              ? makeLocAlt(bigDataIdx, `${bigDataUrl}.bai`, trackDbLoc)
              : makeLoc2(bigDataIdx, `${bigDataUrl}.bai`),
          },
        },
      }

    case 'cram':
      return {
        type: 'AlignmentsTrack',
        name,
        description: data.longLabel,
        category: categories,
        adapter: {
          type: 'CramAdapter',
          cramLocation: bigDataLocation,
          craiLocation: isUri
            ? makeLocAlt(bigDataIdx, `${bigDataUrl}.crai`, trackDbLoc)
            : makeLoc2(bigDataIdx, `${bigDataUrl}.crai`),
          sequenceAdapter,
        },
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
        type: 'FeatureTrack',
        name,
        description: data.longLabel,
        category: categories,
        adapter: {
          type: 'BigBedAdapter',
          bigBedLocation: bigDataLocation,
        },
      }
    case 'bigWig':
      return {
        type: 'QuantitativeTrack',
        name,
        description: data.longLabel,
        category: categories,
        adapter: {
          type: 'BigWigAdapter',
          bigWigLocation: bigDataLocation,
        },
      }

    case 'vcfTabix':
      return {
        type: 'VariantTrack',
        name,
        description: data.longLabel,
        category: categories,
        adapter: {
          type: 'VcfTabixAdapter',
          vcfGzLocation: bigDataLocation,
          index: {
            location: isUri
              ? makeLocAlt(bigDataIdx, `${bigDataUrl}.tbi`, trackDbLoc)
              : makeLoc2(bigDataIdx, `${bigDataUrl}.tbi`),
          },
        },
      }

    case 'hic':
      return {
        type: 'HicTrack',
        name,
        description: data.longLabel,
        category: categories,
        adapter: {
          type: 'HicAdapter',
          hicLocation: bigDataLocation,
        },
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
