import { objectHash } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import {
  UNKNOWN,
  UNSUPPORTED,
  generateUnknownTrackConf,
  generateUnsupportedTrackConf,
  guessAdapter,
  guessTrackType,
} from '@jbrowse/core/util/tracks'

import type { RefSeq, RefSeqs, Track } from './types.ts'

interface Jb2Track {
  trackId: string
  name: string
  description?: string
  category?: string[]
  adapter?: Jb2Adapter
  type?: string
  defaultRendering?: string
}

interface Jb2Adapter {
  type: string
  features?: Jb2Feature[]
  bamLocation?: Jb2Location
  cramLocation?: Jb2Location
  craiLocation?: Jb2Location
  fastaLocation?: Jb2Location
  faiLocation?: Jb2Location
  gziLocation?: Jb2Location
  twoBitLocation?: Jb2Location
  bigWigLocation?: Jb2Location
  bigBedLocation?: Jb2Location
  vcfGzLocation?: Jb2Location
  gffLocation?: Jb2Location
  gffGzLocation?: Jb2Location
  gtfLocation?: Jb2Location
  bedGzLocation?: Jb2Location
  index?: { location: Jb2Location; indexType?: string }
  rootUrlTemplate?: Jb2Location
}

interface Jb2Feature {
  refName: string
  uniqueId: string
  start: number
  end: number
}

interface Jb2Location {
  uri?: string
  localPath?: string
  blobId?: string
  locationType?: string
}

function resolveIndex(
  jb1TrackConfig: Track,
  urlTemplate: string,
  resolve: (t: string) => string,
  primaryKey: 'baiUrlTemplate' | 'tbiUrlTemplate',
  defaultExt: string,
): { location: Jb2Location; indexType?: string } {
  const primary = jb1TrackConfig[primaryKey]
  if (primary) {
    return { location: { uri: resolve(primary), locationType: 'UriLocation' } }
  }
  if (jb1TrackConfig.csiUrlTemplate) {
    return {
      location: {
        uri: resolve(jb1TrackConfig.csiUrlTemplate),
        locationType: 'UriLocation',
      },
      indexType: 'CSI',
    }
  }
  return {
    location: {
      uri: `${urlTemplate}.${defaultExt}`,
      locationType: 'UriLocation',
    },
  }
}

export function convertTrackConfig(
  jb1TrackConfig: Track,
  dataRoot: string,
): Jb2Track {
  const jb2TrackConfig: Jb2Track = {
    trackId: objectHash(jb1TrackConfig),
    name: jb1TrackConfig.key || jb1TrackConfig.label,
  }

  const description =
    jb1TrackConfig.metadata &&
    (jb1TrackConfig.metadata.description || jb1TrackConfig.metadata.Description)
  if (description) {
    jb2TrackConfig.description = description
  }

  const category = jb1TrackConfig.category || jb1TrackConfig.metadata?.category
  jb2TrackConfig.category = category ? category.split(/\s*\/\s*/) : []

  const { storeClass } = jb1TrackConfig
  if (!jb1TrackConfig.urlTemplate) {
    if (!storeClass?.endsWith('FromConfig')) {
      const trackIdentifier = jb1TrackConfig.key || jb1TrackConfig.label
      console.warn(
        `Could not import JBrowse1 track "${trackIdentifier}" because it does not have a "urlTemplate" or is not a "FromConfig" track`,
      )
      return generateUnsupportedTrackConf(
        jb2TrackConfig.name,
        trackIdentifier,
        jb2TrackConfig.category,
      )
    }
    return generateFromConfigTrackConfig(jb1TrackConfig, jb2TrackConfig)
  }

  const resolve = (urlTemplate: string) =>
    new URL(urlTemplate, `${dataRoot}/`).href
      .replaceAll(/%7B/gi, '{')
      .replaceAll(/%7D/gi, '}')

  const urlTemplate = resolve(jb1TrackConfig.urlTemplate)

  if (storeClass) {
    if (storeClass === 'JBrowse/Store/SeqFeature/BAM') {
      return {
        ...jb2TrackConfig,
        type: 'AlignmentsTrack',
        adapter: {
          type: 'BamAdapter',
          bamLocation: { uri: urlTemplate, locationType: 'UriLocation' },
          index: resolveIndex(
            jb1TrackConfig,
            urlTemplate,
            resolve,
            'baiUrlTemplate',
            'bai',
          ),
        },
      }
    }
    if (storeClass === 'JBrowse/Store/SeqFeature/CRAM') {
      return {
        ...jb2TrackConfig,
        type: 'AlignmentsTrack',
        adapter: {
          type: 'CramAdapter',
          cramLocation: { uri: urlTemplate, locationType: 'UriLocation' },
          craiLocation: jb1TrackConfig.craiUrlTemplate
            ? {
                uri: resolve(jb1TrackConfig.craiUrlTemplate),
                locationType: 'UriLocation',
              }
            : {
                uri: `${urlTemplate}.crai`,
                locationType: 'UriLocation',
              },
        },
      }
    }
    if (storeClass === 'JBrowse/Store/SeqFeature/NCList') {
      return {
        ...jb2TrackConfig,
        type: 'FeatureTrack',
        adapter: {
          type: 'NCListAdapter',
          rootUrlTemplate: { uri: urlTemplate, locationType: 'UriLocation' },
        },
      }
    }
    if (
      storeClass === 'JBrowse/Store/SeqFeature/BigWig' ||
      storeClass === 'JBrowse/Store/BigWig'
    ) {
      if (jb1TrackConfig.type?.endsWith('XYPlot')) {
        jb2TrackConfig.defaultRendering = 'xyplot'
      } else if (jb1TrackConfig.type?.endsWith('Density')) {
        jb2TrackConfig.defaultRendering = 'density'
      }
      return {
        ...jb2TrackConfig,
        type: 'QuantitativeTrack',
        adapter: {
          type: 'BigWigAdapter',
          bigWigLocation: { uri: urlTemplate, locationType: 'UriLocation' },
        },
      }
    }
    if (storeClass === 'JBrowse/Store/SeqFeature/VCFTabix') {
      return {
        ...jb2TrackConfig,
        type: 'VariantTrack',
        adapter: {
          type: 'VcfTabixAdapter',
          vcfGzLocation: { uri: urlTemplate, locationType: 'UriLocation' },
          index: resolveIndex(
            jb1TrackConfig,
            urlTemplate,
            resolve,
            'tbiUrlTemplate',
            'tbi',
          ),
        },
      }
    }
    if (storeClass === 'JBrowse/Store/SeqFeature/VCFTribble') {
      return generateUnsupportedTrackConf(
        jb2TrackConfig.name,
        `VCFTribble (${urlTemplate})`,
        jb2TrackConfig.category,
      )
    }
    if (storeClass === 'JBrowse/Store/SeqFeature/GFF3') {
      return {
        ...jb2TrackConfig,
        type: 'FeatureTrack',
        adapter: {
          type: 'Gff3Adapter',
          gffLocation: { uri: urlTemplate, locationType: 'UriLocation' },
        },
      }
    }
    if (storeClass === 'JBrowse/Store/SeqFeature/BigBed') {
      return {
        ...jb2TrackConfig,
        type: 'FeatureTrack',
        adapter: {
          type: 'BigBedAdapter',
          bigBedLocation: { uri: urlTemplate, locationType: 'UriLocation' },
        },
      }
    }
    if (storeClass === 'JBrowse/Store/SeqFeature/GFF3Tabix') {
      return {
        ...jb2TrackConfig,
        type: 'FeatureTrack',
        adapter: {
          type: 'Gff3TabixAdapter',
          gffGzLocation: { uri: urlTemplate, locationType: 'UriLocation' },
          index: resolveIndex(
            jb1TrackConfig,
            urlTemplate,
            resolve,
            'tbiUrlTemplate',
            'tbi',
          ),
        },
      }
    }
    if (storeClass === 'JBrowse/Store/SeqFeature/BED') {
      return generateUnsupportedTrackConf(
        jb2TrackConfig.name,
        `BED (${urlTemplate})`,
        jb2TrackConfig.category,
      )
    }
    if (storeClass === 'JBrowse/Store/SeqFeature/BEDTabix') {
      return {
        ...jb2TrackConfig,
        type: 'FeatureTrack',
        adapter: {
          type: 'BedTabixAdapter',
          bedGzLocation: { uri: urlTemplate, locationType: 'UriLocation' },
          index: resolveIndex(
            jb1TrackConfig,
            urlTemplate,
            resolve,
            'tbiUrlTemplate',
            'tbi',
          ),
        },
      }
    }
    if (storeClass === 'JBrowse/Store/SeqFeature/GTF') {
      return {
        ...jb2TrackConfig,
        type: 'FeatureTrack',
        adapter: {
          type: 'GtfAdapter',
          gtfLocation: { uri: urlTemplate, locationType: 'UriLocation' },
        },
      }
    }
    if (
      storeClass === 'JBrowse/Store/SeqFeature/StaticChunked' ||
      storeClass === 'JBrowse/Store/Sequence/StaticChunked'
    ) {
      return generateUnsupportedTrackConf(
        jb2TrackConfig.name,
        `StaticChunked (${urlTemplate})`,
        jb2TrackConfig.category,
      )
    }
    if (storeClass === 'JBrowse/Store/SeqFeature/UnindexedFasta') {
      return generateUnsupportedTrackConf(
        jb2TrackConfig.name,
        `UnindexedFasta (${urlTemplate})`,
        jb2TrackConfig.category,
      )
    }
    if (storeClass === 'JBrowse/Store/SeqFeature/IndexedFasta') {
      return {
        ...jb2TrackConfig,
        type: 'SequenceTrack',
        adapter: {
          type: 'IndexedFastaAdapter',
          fastaLocation: { uri: urlTemplate, locationType: 'UriLocation' },
          faiLocation: jb1TrackConfig.faiUrlTemplate
            ? {
                uri: resolve(jb1TrackConfig.faiUrlTemplate),
                locationType: 'UriLocation',
              }
            : {
                uri: `${urlTemplate}.fai`,
                locationType: 'UriLocation',
              },
        },
      }
    }
    if (storeClass === 'JBrowse/Store/SeqFeature/BgzipIndexedFasta') {
      return {
        ...jb2TrackConfig,
        type: 'ReferenceSequenceTrack',
        adapter: {
          type: 'BgzipFastaAdapter',
          fastaLocation: { uri: urlTemplate, locationType: 'UriLocation' },
          faiLocation: jb1TrackConfig.faiUrlTemplate
            ? {
                uri: resolve(jb1TrackConfig.faiUrlTemplate),
                locationType: 'UriLocation',
              }
            : {
                uri: `${urlTemplate}.fai`,
                locationType: 'UriLocation',
              },
          gziLocation: jb1TrackConfig.gziUrlTemplate
            ? {
                uri: resolve(jb1TrackConfig.gziUrlTemplate),
                locationType: 'UriLocation',
              }
            : {
                uri: `${urlTemplate}.gzi`,
                locationType: 'UriLocation',
              },
        },
      }
    }
    if (storeClass === 'JBrowse/Store/SeqFeature/TwoBit') {
      return {
        ...jb2TrackConfig,
        type: 'ReferenceSequenceTrack',
        adapter: {
          type: 'TwoBitAdapter',
          twoBitLocation: { uri: urlTemplate, locationType: 'UriLocation' },
        },
      }
    }
  }

  jb2TrackConfig.adapter = guessAdapter(
    { uri: urlTemplate, locationType: 'UriLocation' },
    undefined,
    urlTemplate,
  )

  if (jb2TrackConfig.adapter.type === UNSUPPORTED) {
    return generateUnsupportedTrackConf(
      jb2TrackConfig.name,
      urlTemplate,
      jb2TrackConfig.category,
    )
  }
  if (jb2TrackConfig.adapter.type === UNKNOWN) {
    return generateUnknownTrackConf(
      jb2TrackConfig.name,
      urlTemplate,
      jb2TrackConfig.category,
    )
  }

  jb2TrackConfig.type = guessTrackType(jb2TrackConfig.adapter.type)

  if (jb2TrackConfig.type === 'QuantitativeTrack') {
    if (jb1TrackConfig.type?.endsWith('XYPlot')) {
      jb2TrackConfig.defaultRendering = 'xyplot'
    } else if (jb1TrackConfig.type?.endsWith('Density')) {
      jb2TrackConfig.defaultRendering = 'density'
    }
  }

  return jb2TrackConfig
}

function generateFromConfigTrackConfig(
  jb1TrackConfig: Track,
  jb2TrackConfig: Jb2Track,
): Jb2Track {
  const jb1Features = jb1TrackConfig.features ?? []
  const features = jb1Features.map(
    (f): Jb2Feature => ({
      refName: f.seq_id,
      uniqueId: `${f.seq_id}:${f.start}-${f.end}:${f.name ?? ''}`,
      start: f.start,
      end: f.end,
    }),
  )
  return {
    ...jb2TrackConfig,
    type: 'FeatureTrack',
    adapter: { type: 'FromConfigAdapter', features },
  }
}

export async function createRefSeqsAdapter(
  refSeqs: string | RefSeqs,
): Promise<Jb2Adapter> {
  if (typeof refSeqs === 'string') {
    refSeqs = { url: refSeqs }
  }

  if (refSeqs.url) {
    if (/.fai$/.test(refSeqs.url)) {
      return {
        type: 'IndexedFastaAdapter',
        fastaLocation: {
          uri: refSeqs.url.slice(0, -4),
          locationType: 'UriLocation',
        },
        faiLocation: {
          uri: refSeqs.url,
          locationType: 'UriLocation',
        },
      }
    }
    if (/.2bit$/.test(refSeqs.url)) {
      return {
        type: 'TwoBitAdapter',
        twoBitLocation: { uri: refSeqs.url, locationType: 'UriLocation' },
      }
    }
    if (/.fa$/.test(refSeqs.url)) {
      throw new Error('Unindexed FASTA adapter not available')
    }
    if (/.sizes/.test(refSeqs.url)) {
      throw new Error('chromosome SIZES adapter not available')
    }
    const refSeqsJson = await openLocation({
      uri: refSeqs.url,
      locationType: 'UriLocation',
    }).readFile('utf8')
    const refSeqsData: RefSeq[] = JSON.parse(refSeqsJson)
    return refSeqAdapterFromConfig(refSeqsData)
  }
  if ('data' in refSeqs) {
    return refSeqAdapterFromConfig(refSeqs.data ?? [])
  }
  throw new Error(
    `Could not determine adapter for JBrowse1 refSeqs: ${
      refSeqs.url || JSON.stringify(refSeqs)
    }`,
  )
}

function refSeqAdapterFromConfig(refSeqsData: RefSeq[]): Jb2Adapter {
  const features = refSeqsData.map(
    (refSeq): Jb2Feature => ({
      refName: refSeq.name,
      uniqueId: refSeq.name,
      start: refSeq.start,
      end: refSeq.end,
    }),
  )
  return {
    type: 'FromConfigAdapter',
    features,
  }
}
