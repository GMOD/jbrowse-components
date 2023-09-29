import { AbstractSessionModel, notEmpty } from '@jbrowse/core/util'
import { AssemblyConfigModel } from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import {
  generateUnsupportedTrackConf,
  generateUnknownTrackConf,
} from '@jbrowse/core/util/tracks'

import { RaStanza, TrackDbFile } from '@gmod/ucsc-hub'
import { FileLocation, isUriLocation, objectHash } from '@jbrowse/core/util'
import { SnapshotIn } from 'mobx-state-tree'

import { UnifiedHubData } from '../fetching-utils'
import { getConf } from '@jbrowse/core/configuration'

type Conf = AssemblyConfigModel | SnapshotIn<AssemblyConfigModel>

/** find matching or to-be-created assemblies in our hub data */
export function getAssemblies(
  hubData: UnifiedHubData,
  session: AbstractSessionModel,
) {
  const { assemblyManager } = session
  const genomesFile = hubData.genomes
  const assemblies = new Map<
    string,
    {
      conf: Conf
      isNew?: boolean
    }
  >()
  for (const [genomeName, genome] of genomesFile) {
    const assemblyConf = assemblyManager.get(genomeName)?.configuration
    if (assemblyConf) {
      assemblies.set(genomeName, { conf: assemblyConf })
    } else {
      // TODO: try harder to match assemblies, maybe configuring refname aliases on the fly
      // we can't find a matching assembly, make a new configuration for it
      const twoBitPath = genome.get('twoBitPath')
      const twoBitLocation = twoBitPath
        ? {
            uri: new URL(twoBitPath, hubData.genomesBaseUri).href,
            type: 'UriLocation',
          }
        : undefined
      const chromSizes = genome.get('chromSizes')
      const chromSizesLocation = chromSizes
        ? {
            uri: new URL(chromSizes, hubData.genomesBaseUri).href,
            type: 'UriLocation',
          }
        : undefined
      assemblies.set(genomeName, {
        isNew: true,
        conf: {
          name: genomeName,
          sequence: {
            adapter: {
              type: 'TwoBitAdapter',
              twoBitLocation,
              chromSizesLocation,
            },
          },
        },
      })
    }
    const db = genome.get('trackDb')
    if (!db) {
      throw new Error('genomesFile not found on hub')
    }
    const base = new URL(genomeFile, hubUri)
    const loc = hubUri
      ? {
          uri: new URL(db, base).href,
          locationType: 'UriLocation' as const,
        }
      : {
          localPath: db,
          locationType: 'LocalPathLocation' as const,
        }
    const trackDb = await fetchTrackDbFile(loc)
    const seqAdapter = readConfObject(conf, ['sequence', 'adapter'])
    const tracks = generateTracks(trackDb, loc, genomeName, seqAdapter)
    self.addTrackConfs(tracks)
    map[genomeName] = tracks.length
  }
  return assemblies
}

export function generateTracks(
  trackDb: TrackDbFile,
  trackDbLoc: FileLocation,
  assemblyName: string,
  sequenceAdapter: unknown,
) {
  const parentTrackKeys = new Set([
    'superTrack',
    'compositeTrack',
    'container',
    'view',
  ])
  return [...trackDb.entries()]
    .filter(([_trackName, track]) =>
      [...track.keys()].some(key => parentTrackKeys.has(key)),
    )
    .map(([trackName, track]) => {
      const parentTracks = []
      let currentTrackName = trackName
      do {
        currentTrackName = trackDb.get(currentTrackName)?.get('parent') || ''
        if (currentTrackName) {
          ;[currentTrackName] = currentTrackName.split(' ')
          parentTracks.push(trackDb.get(currentTrackName))
        }
      } while (currentTrackName)
      const categories = parentTracks
        .reverse()
        .map(p => p?.get('shortLabel'))
        .filter(notEmpty)
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
    })
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
  sequenceAdapter: unknown
}) {
  function makeLoc(relative: string, base: { uri: string }) {
    return {
      uri: new URL(relative, base.uri).href,
      locationType: 'UriLocation',
    }
  }

  function makeLocAlt(first: string, alt: string, base: { uri: string }) {
    return first ? makeLoc(first, base) : makeLoc(alt, base)
  }

  function makeLoc2(first: string, alt?: string) {
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
