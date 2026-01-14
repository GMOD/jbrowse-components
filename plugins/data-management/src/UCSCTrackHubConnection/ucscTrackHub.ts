import { isUriLocation, notEmpty, objectHash } from '@jbrowse/core/util'
import { generateUnknownTrackConf } from '@jbrowse/core/util/tracks'

import { makeLoc2, makeLoc, makeLocAlt, resolve } from './util.ts'

import type { RaStanza, TrackDbFile } from '@gmod/ucsc-hub'
import type { FileLocation } from '@jbrowse/core/util'

export function generateTracks({
  trackDb,
  trackDbLoc,
  assemblyName,
  baseUrl,
}: {
  trackDb: TrackDbFile
  trackDbLoc: FileLocation
  assemblyName: string
  baseUrl: string
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

        return {
          metadata: {
            ...track.data,
            ...(track.data.html
              ? {
                  html: `<a href="${resolve(track.data.html, baseUrl)}">${track.data.html}</a>`,
                }
              : {}),
          },
          category: [
            track.data.group,
            ...parentTracks
              .map(p => p?.data.group)
              .filter((f): f is string => !!f),
          ].filter(f => !!f),
          ...makeTrackConfig({
            track,
            trackDbLoc,
            trackDb,
          }),
        }
      }
    })
    .filter(notEmpty)
    .map(r => ({
      ...r,
      trackId: `ucsc-trackhub-${objectHash(r)}`,
      assemblyNames: [assemblyName],
    }))
}

function makeTrackConfig({
  track,
  trackDbLoc,
  trackDb,
}: {
  track: RaStanza
  trackDbLoc: FileLocation
  trackDb: TrackDbFile
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

  if (baseTrackType === 'bam') {
    return {
      type: 'AlignmentsTrack',
      name,
      description: data.longLabel,
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
  } else if (baseTrackType === 'cram') {
    return {
      type: 'AlignmentsTrack',
      name,
      description: data.longLabel,
      adapter: {
        type: 'CramAdapter',
        cramLocation: bigDataLocation,
        craiLocation: isUri
          ? makeLocAlt(bigDataIdx, `${bigDataUrl}.crai`, trackDbLoc)
          : makeLoc2(bigDataIdx, `${bigDataUrl}.crai`),
      },
    }
  } else if (baseTrackType === 'bigWig') {
    return {
      type: 'QuantitativeTrack',
      name,
      description: data.longLabel,
      adapter: {
        type: 'BigWigAdapter',
        bigWigLocation: bigDataLocation,
      },
    }
  } else if (baseTrackType.startsWith('big')) {
    return {
      type: 'FeatureTrack',
      name,
      description: data.longLabel,
      adapter: {
        type: 'BigBedAdapter',
        bigBedLocation: bigDataLocation,
      },
    }
  } else if (baseTrackType === 'vcfTabix') {
    return {
      type: 'VariantTrack',
      name,
      description: data.longLabel,
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
  } else if (baseTrackType === 'hic') {
    return {
      type: 'HicTrack',
      name,
      description: data.longLabel,
      adapter: {
        type: 'HicAdapter',
        hicLocation: bigDataLocation,
      },
    }
  } else {
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
    return generateUnknownTrackConf(name, baseTrackType)
  }
}
