import objectHash from 'object-hash'
import { generateUnsupportedTrackConf } from '@gmod/jbrowse-core/util/tracks'

export function generateTracks(trackDb, assemblyName, sequenceAdapter) {
  // eslint-disable-next-line no-underscore-dangle
  const { configuration } = trackDb._source
  const subTracks = getSubtracks({ members: configuration })
  return subTracks.map(subTrack => {
    const ret = makeTrackConfig(
      subTrack,
      // eslint-disable-next-line no-underscore-dangle
      trackDb._source.hub.url,
      sequenceAdapter,
    )
    // @ts-ignore
    ret.trackId = `trackhub-registry-${objectHash(ret)}`
    // @ts-ignore
    ret.assemblyNames = [assemblyName]
    return ret
  })

  function getSubtracks(track, trackPath = []) {
    if (track.members)
      return Object.values(track.members)
        .map(subTrack =>
          getSubtracks(
            subTrack,
            track.shortLabel ? trackPath.concat([track.shortLabel]) : trackPath,
          ),
        )
        .flat()
    track.categories = trackPath
    return [track]
  }
}

function makeTrackConfig(track, trackDbUrl, sequenceAdapter) {
  const trackType = track.type
  let baseTrackType = trackType.split(' ')[0].toLowerCase()
  if (
    baseTrackType === 'bam' &&
    track.bigDataUrl.toLowerCase().endsWith('cram')
  )
    baseTrackType = 'cram'
  const { bigDataUrl } = track
  const bigDataLocation = {
    uri: new URL(bigDataUrl, trackDbUrl).href,
  }
  const { categories } = track
  let bigDataIndexLocation
  switch (baseTrackType) {
    case 'bam':
      if (trackDbUrl)
        bigDataIndexLocation = track.bigDataIndex
          ? {
              uri: new URL(track.bigDataIndex, trackDbUrl).href,
            }
          : {
              uri: new URL(`${track.bigDataUrl}.bai`, trackDbUrl).href,
            }
      else
        bigDataIndexLocation = track.bigDataIndex
          ? { localPath: track.bigDataIndex }
          : { localPath: `${track.bigDataUrl}.bai` }
      return {
        type: 'PileupTrack',
        name: track.shortLabel,
        description: track.longLabel,
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
        track.shortLabel,
        baseTrackType,
        categories,
      )
    case 'bed5floatscore':
      return generateUnsupportedTrackConf(
        track.shortLabel,
        baseTrackType,
        categories,
      )
    case 'bedgraph':
      return generateUnsupportedTrackConf(
        track.shortLabel,
        baseTrackType,
        categories,
      )
    case 'bedrnaelements':
      return generateUnsupportedTrackConf(
        track.shortLabel,
        baseTrackType,
        categories,
      )
    case 'bigbarchart':
      return generateUnsupportedTrackConf(
        track.shortLabel,
        baseTrackType,
        categories,
      )
    case 'bigbed':
      return {
        type: 'BasicTrack',
        name: track.shortLabel,
        description: track.longLabel,
        category: categories,
        renderer: { type: 'SvgFeatureRenderer' },
        adapter: {
          type: 'BigBedAdapter',
          bigBedLocation: bigDataLocation,
        },
      }
    case 'bigchain':
      return generateUnsupportedTrackConf(
        track.shortLabel,
        baseTrackType,
        categories,
      )
    case 'biginteract':
      return generateUnsupportedTrackConf(
        track.shortLabel,
        baseTrackType,
        categories,
      )
    case 'bigmaf':
      return generateUnsupportedTrackConf(
        track.shortLabel,
        baseTrackType,
        categories,
      )
    case 'bigpsl':
      return generateUnsupportedTrackConf(
        track.shortLabel,
        baseTrackType,
        categories,
      )
    case 'bigwig':
      return {
        type: 'WiggleTrack',
        name: track.shortLabel,
        description: track.longLabel,
        category: categories,
        adapter: {
          type: 'BigWigAdapter',
          bigWigLocation: bigDataLocation,
        },
      }
    case 'broadpeak':
      return generateUnsupportedTrackConf(
        track.shortLabel,
        baseTrackType,
        categories,
      )
    case 'coloredexon':
      return generateUnsupportedTrackConf(
        track.shortLabel,
        baseTrackType,
        categories,
      )
    case 'cram':
      if (trackDbUrl)
        bigDataIndexLocation = track.bigDataIndex
          ? {
              uri: new URL(track.bigDataIndex, trackDbUrl).href,
            }
          : {
              uri: new URL(`${track.bigDataUrl}.bai`, trackDbUrl).href,
            }
      else
        bigDataIndexLocation = track.bigDataIndex
          ? { localPath: track.bigDataIndex }
          : { localPath: `${track.bigDataUrl}.bai` }
      return {
        type: 'PileupTrack',
        name: track.shortLabel,
        description: track.longLabel,
        category: categories,
        adapter: {
          type: 'CramAdapter',
          bamLocation: bigDataLocation,
          index: { location: bigDataIndexLocation },
          sequenceAdapter,
        },
      }
    case 'gvf':
      return generateUnsupportedTrackConf(
        track.shortLabel,
        baseTrackType,
        categories,
      )
    case 'ld2':
      return generateUnsupportedTrackConf(
        track.shortLabel,
        baseTrackType,
        categories,
      )
    case 'narrowpeak':
      return generateUnsupportedTrackConf(
        track.shortLabel,
        baseTrackType,
        categories,
      )
    case 'peptidemapping':
      return generateUnsupportedTrackConf(
        track.shortLabel,
        baseTrackType,
        categories,
      )
    case 'vcftabix':
      return generateUnsupportedTrackConf(
        track.shortLabel,
        baseTrackType,
        categories,
      )
    case 'wig':
      return generateUnsupportedTrackConf(
        track.shortLabel,
        baseTrackType,
        categories,
      )
    case 'wigmaf':
      return generateUnsupportedTrackConf(
        track.shortLabel,
        baseTrackType,
        categories,
      )
    default:
      throw new Error(`Unsupported track type: ${baseTrackType}`)
  }
}
