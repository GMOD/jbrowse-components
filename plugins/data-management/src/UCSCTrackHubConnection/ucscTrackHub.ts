import { notEmpty, objectHash } from '@jbrowse/core/util'
import { generateUnknownTrackConf } from '@jbrowse/core/util/tracks'

import { htmlLink, makeLoc } from './util.ts'

import type { HubLocation } from './util.ts'
import type { RaStanza, TrackDbFile } from '@gmod/ucsc-hub'

export function generateTracks({
  trackDb,
  trackDbLoc,
  assemblyName,
  baseUrl,
}: {
  trackDb: TrackDbFile
  trackDbLoc: HubLocation
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
            currentTrackName = currentTrackName.split(' ', 1)[0]!
            parentTracks.push(trackDb.data[currentTrackName])
          }
        } while (currentTrackName)
        parentTracks.reverse()

        return {
          metadata: {
            ...track.data,
            ...(track.data.html
              ? { html: htmlLink(track.data.html, baseUrl) }
              : {}),
          },
          category: [
            track.data.group,
            ...parentTracks.map(p => p?.data.group),
          ].filter((f): f is string => !!f),
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
  trackDbLoc: HubLocation
  trackDb: TrackDbFile
}) {
  const { data } = track

  const parent = data.parent || ''
  const bigDataUrl = data.bigDataUrl || ''
  const bigDataIdx = data.bigDataIndex || ''
  const trackType = data.type || trackDb.data[parent]?.data.type || ''
  const name =
    (data.shortLabel || '') + (bigDataUrl.includes('xeno') ? ' (xeno)' : '')
  const description = data.longLabel

  let baseTrackType = trackType.split(' ', 1)[0] || ''
  if (baseTrackType === 'bam' && bigDataUrl.toLowerCase().endsWith('cram')) {
    baseTrackType = 'cram'
  }
  const bigDataLocation = makeLoc(bigDataUrl, trackDbLoc)

  if (baseTrackType === 'bam') {
    return {
      type: 'AlignmentsTrack',
      name,
      description,
      adapter: {
        type: 'BamAdapter',
        bamLocation: bigDataLocation,
        index: {
          location: makeLoc(bigDataIdx, trackDbLoc, `${bigDataUrl}.bai`),
        },
      },
    }
  } else if (baseTrackType === 'cram') {
    return {
      type: 'AlignmentsTrack',
      name,
      description,
      adapter: {
        type: 'CramAdapter',
        cramLocation: bigDataLocation,
        craiLocation: makeLoc(bigDataIdx, trackDbLoc, `${bigDataUrl}.crai`),
      },
    }
  } else if (baseTrackType === 'bigWig') {
    return {
      type: 'QuantitativeTrack',
      name,
      description,
      adapter: {
        type: 'BigWigAdapter',
        bigWigLocation: bigDataLocation,
      },
    }
  } else if (baseTrackType.startsWith('big')) {
    return {
      type: 'FeatureTrack',
      name,
      description,
      adapter: {
        type: 'BigBedAdapter',
        bigBedLocation: bigDataLocation,
      },
    }
  } else if (baseTrackType === 'vcfTabix') {
    return {
      type: 'VariantTrack',
      name,
      description,
      adapter: {
        type: 'VcfTabixAdapter',
        vcfGzLocation: bigDataLocation,
        index: {
          location: makeLoc(bigDataIdx, trackDbLoc, `${bigDataUrl}.tbi`),
        },
      },
    }
  } else if (baseTrackType === 'hic') {
    return {
      type: 'HicTrack',
      name,
      description,
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
