import { openLocation } from '@jbrowse/core/util/io'
import { objectHash } from '@jbrowse/core/util'
import {
  generateUnknownTrackConf,
  generateUnsupportedTrackConf,
  guessAdapter,
  guessTrackType,
  UNKNOWN,
  UNSUPPORTED,
} from '@jbrowse/core/util/tracks'
import { Track, RefSeqs, RefSeq } from './types'

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
  sequenceAdapter?: Jb2Adapter
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

export function convertTrackConfig(
  jb1TrackConfig: Track,
  dataRoot: string,
  sequenceAdapter: Jb2Adapter,
): Jb2Track {
  const jb2TrackConfig: Jb2Track = {
    name: jb1TrackConfig.key || jb1TrackConfig.label,
    trackId: objectHash(jb1TrackConfig),
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
    if (!(storeClass && storeClass.endsWith('FromConfig'))) {
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

  const resolveUrlTemplate = (urlTemplate: string) => {
    return new URL(urlTemplate, `${dataRoot}/`).href
      .replaceAll(/%7B/gi, '{')
      .replaceAll(/%7D/gi, '}')
  }
  const urlTemplate = resolveUrlTemplate(jb1TrackConfig.urlTemplate)

  if (storeClass) {
    if (storeClass === 'JBrowse/Store/SeqFeature/BAM') {
      const adapter: Jb2Adapter = {
        bamLocation: { locationType: 'UriLocation', uri: urlTemplate },
        type: 'BamAdapter',
      }
      if (jb1TrackConfig.baiUrlTemplate) {
        adapter.index = {
          location: {
            locationType: 'UriLocation',
            uri: resolveUrlTemplate(jb1TrackConfig.baiUrlTemplate),
          },
        }
      } else if (jb1TrackConfig.csiUrlTemplate) {
        adapter.index = {
          indexType: 'CSI',
          location: {
            locationType: 'UriLocation',
            uri: resolveUrlTemplate(jb1TrackConfig.csiUrlTemplate),
          },
        }
      } else {
        adapter.index = {
          location: { locationType: 'UriLocation', uri: `${urlTemplate}.bai` },
        }
      }
      return {
        ...jb2TrackConfig,
        adapter,
        type: 'AlignmentsTrack',
      }
    }
    if (storeClass === 'JBrowse/Store/SeqFeature/CRAM') {
      const adapter: Jb2Adapter = {
        cramLocation: { locationType: 'UriLocation', uri: urlTemplate },
        sequenceAdapter,
        type: 'CramAdapter',
      }
      adapter.craiLocation = jb1TrackConfig.craiUrlTemplate
        ? {
            locationType: 'UriLocation',
            uri: resolveUrlTemplate(jb1TrackConfig.craiUrlTemplate),
          }
        : {
            locationType: 'UriLocation',
            uri: `${urlTemplate}.crai`,
          }
      return {
        ...jb2TrackConfig,
        adapter,
        type: 'AlignmentsTrack',
      }
    }
    if (storeClass === 'JBrowse/Store/SeqFeature/NCList') {
      return {
        ...jb2TrackConfig,
        adapter: {
          rootUrlTemplate: { locationType: 'UriLocation', uri: urlTemplate },
          type: 'NCListAdapter',
        },
        type: 'FeatureTrack',
      }
    }
    if (
      storeClass === 'JBrowse/Store/SeqFeature/BigWig' ||
      storeClass === 'JBrowse/Store/BigWig'
    ) {
      if (jb1TrackConfig.type && jb1TrackConfig.type.endsWith('XYPlot')) {
        jb2TrackConfig.defaultRendering = 'xyplot'
      } else if (
        jb1TrackConfig.type &&
        jb1TrackConfig.type.endsWith('Density')
      ) {
        jb2TrackConfig.defaultRendering = 'density'
      }
      return {
        ...jb2TrackConfig,
        adapter: {
          bigWigLocation: { locationType: 'UriLocation', uri: urlTemplate },
          type: 'BigWigAdapter',
        },
        type: 'QuantitativeTrack',
      }
    }
    if (storeClass === 'JBrowse/Store/SeqFeature/VCFTabix') {
      const adapter: Jb2Adapter = {
        type: 'VcfTabixAdapter',
        vcfGzLocation: { locationType: 'UriLocation', uri: urlTemplate },
      }
      if (jb1TrackConfig.tbiUrlTemplate) {
        adapter.index = {
          location: {
            locationType: 'UriLocation',
            uri: resolveUrlTemplate(jb1TrackConfig.tbiUrlTemplate),
          },
        }
      } else if (jb1TrackConfig.csiUrlTemplate) {
        adapter.index = {
          indexType: 'CSI',
          location: {
            locationType: 'UriLocation',
            uri: resolveUrlTemplate(jb1TrackConfig.csiUrlTemplate),
          },
        }
      } else {
        adapter.index = {
          location: { locationType: 'UriLocation', uri: `${urlTemplate}.tbi` },
        }
      }
      return {
        ...jb2TrackConfig,
        adapter,
        type: 'VariantTrack',
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
        adapter: {
          gffLocation: { locationType: 'UriLocation', uri: urlTemplate },
          type: 'Gff3Adapter',
        },
        type: 'FeatureTrack',
      }
    }
    if (storeClass === 'JBrowse/Store/SeqFeature/BigBed') {
      return {
        ...jb2TrackConfig,
        adapter: {
          bigBedLocation: { locationType: 'UriLocation', uri: urlTemplate },
          type: 'BigBedAdapter',
        },
        type: 'FeatureTrack',
      }
    }
    if (storeClass === 'JBrowse/Store/SeqFeature/GFF3Tabix') {
      const adapter: Jb2Adapter = {
        gffGzLocation: { locationType: 'UriLocation', uri: urlTemplate },
        type: 'Gff3TabixAdapter',
      }
      if (jb1TrackConfig.tbiUrlTemplate) {
        adapter.index = {
          location: {
            locationType: 'UriLocation',
            uri: resolveUrlTemplate(jb1TrackConfig.tbiUrlTemplate),
          },
        }
      } else if (jb1TrackConfig.csiUrlTemplate) {
        adapter.index = {
          indexType: 'CSI',
          location: {
            locationType: 'UriLocation',
            uri: resolveUrlTemplate(jb1TrackConfig.csiUrlTemplate),
          },
        }
      } else {
        adapter.index = {
          location: { locationType: 'UriLocation', uri: `${urlTemplate}.tbi` },
        }
      }
      return {
        ...jb2TrackConfig,
        adapter,
        type: 'FeatureTrack',
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
      const adapter: Jb2Adapter = {
        bedGzLocation: { locationType: 'UriLocation', uri: urlTemplate },
        type: 'BedTabixAdapter',
      }
      if (jb1TrackConfig.tbiUrlTemplate) {
        adapter.index = {
          location: {
            locationType: 'UriLocation',
            uri: resolveUrlTemplate(jb1TrackConfig.tbiUrlTemplate),
          },
        }
      } else if (jb1TrackConfig.csiUrlTemplate) {
        adapter.index = {
          indexType: 'CSI',
          location: {
            locationType: 'UriLocation',
            uri: resolveUrlTemplate(jb1TrackConfig.csiUrlTemplate),
          },
        }
      } else {
        adapter.index = {
          location: { locationType: 'UriLocation', uri: `${urlTemplate}.tbi` },
        }
      }
      return {
        ...jb2TrackConfig,
        adapter,
        type: 'FeatureTrack',
      }
    }
    if (storeClass === 'JBrowse/Store/SeqFeature/GTF') {
      return {
        ...jb2TrackConfig,
        adapter: {
          gtfLocation: { locationType: 'UriLocation', uri: urlTemplate },
          type: 'GtfAdapter',
        },
        type: 'FeatureTrack',
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
      const adapter: Jb2Adapter = {
        fastaLocation: { locationType: 'UriLocation', uri: urlTemplate },
        type: 'IndexedFastaAdapter',
      }
      adapter.faiLocation = jb1TrackConfig.faiUrlTemplate
        ? {
            locationType: 'UriLocation',
            uri: resolveUrlTemplate(jb1TrackConfig.faiUrlTemplate),
          }
        : {
            locationType: 'UriLocation',
            uri: `${urlTemplate}.fai`,
          }
      return {
        ...jb2TrackConfig,
        adapter,
        type: 'SequenceTrack',
      }
    }
    if (storeClass === 'JBrowse/Store/SeqFeature/BgzipIndexedFasta') {
      const adapter: Jb2Adapter = {
        fastaLocation: { locationType: 'UriLocation', uri: urlTemplate },
        type: 'BgzipFastaAdapter',
      }
      adapter.faiLocation = jb1TrackConfig.faiUrlTemplate
        ? {
            locationType: 'UriLocation',
            uri: resolveUrlTemplate(jb1TrackConfig.faiUrlTemplate),
          }
        : {
            locationType: 'UriLocation',
            uri: `${urlTemplate}.fai`,
          }
      adapter.gziLocation = jb1TrackConfig.gziUrlTemplate
        ? {
            locationType: 'UriLocation',
            uri: resolveUrlTemplate(jb1TrackConfig.gziUrlTemplate),
          }
        : {
            locationType: 'UriLocation',
            uri: `${urlTemplate}.gzi`,
          }
      return {
        ...jb2TrackConfig,
        adapter,
        type: 'ReferenceSequenceTrack',
      }
    }
    if (storeClass === 'JBrowse/Store/SeqFeature/TwoBit') {
      return {
        ...jb2TrackConfig,
        adapter: {
          twoBitLocation: { locationType: 'UriLocation', uri: urlTemplate },
          type: 'TwoBitAdapter',
        },
        type: 'ReferenceSequenceTrack',
      }
    }
  }

  // If we don't recognize the store class, make a best effort to guess by file type
  jb2TrackConfig.adapter = guessAdapter(
    { locationType: 'UriLocation', uri: urlTemplate },
    undefined,
    urlTemplate,
  )
  if (!jb2TrackConfig.adapter) {
    throw new Error('Could not determine adapter')
  }

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
    if (jb1TrackConfig.type && jb1TrackConfig.type.endsWith('XYPlot')) {
      jb2TrackConfig.defaultRendering = 'xyplot'
    } else if (jb1TrackConfig.type && jb1TrackConfig.type.endsWith('Density')) {
      jb2TrackConfig.defaultRendering = 'density'
    }
  }

  return jb2TrackConfig
}

function generateFromConfigTrackConfig(
  jb1TrackConfig: Track,
  jb2TrackConfig: Jb2Track,
): Jb2Track {
  const jb1Features = jb1TrackConfig.features || []
  const jb2Features = jb1Features.map((feature): Jb2Feature => {
    const jb2Feature: Jb2Feature = JSON.parse(JSON.stringify(feature))
    jb2Feature.refName = feature.seq_id
    jb2Feature.uniqueId = `${feature.seq_id}:${feature.start}-${feature.end}:${
      feature.name || ''
    }`
    return jb2Feature
  })
  jb2TrackConfig.adapter = {
    features: jb2Features,
    type: 'FromConfigAdapter',
  }
  jb2TrackConfig.type = 'FeatureTrack'
  return jb2TrackConfig
}

export async function createRefSeqsAdapter(
  refSeqs: string | RefSeqs,
): Promise<Jb2Adapter> {
  if (typeof refSeqs === 'string') {
    // assume refSeqs is a url if it is string
    refSeqs = {
      url: refSeqs,
    }
  }

  // check refseq urls
  if (refSeqs.url) {
    if (refSeqs.url.match(/.fai$/)) {
      return {
        faiLocation: {
          locationType: 'UriLocation',
          uri: refSeqs.url,
        },
        fastaLocation: {
          locationType: 'UriLocation',
          uri: refSeqs.url.slice(0, -4),
        },
        type: 'IndexedFastaAdapter',
      }
    }
    if (refSeqs.url.match(/.2bit$/)) {
      return {
        twoBitLocation: { locationType: 'UriLocation', uri: refSeqs.url },
        type: 'TwoBitAdapter',
      }
    }
    if (refSeqs.url.match(/.fa$/)) {
      throw new Error('Unindexed FASTA adapter not available')
    }
    if (refSeqs.url.match(/.sizes/)) {
      throw new Error('chromosome SIZES adapter not available')
    }
    const refSeqsJson = await openLocation({
      locationType: 'UriLocation',
      uri: refSeqs.url,
    }).readFile('utf8')
    const refSeqsData: RefSeq[] = JSON.parse(refSeqsJson)
    return refSeqAdapterFromConfig(refSeqsData)
  }
  if ('data' in refSeqs) {
    return refSeqAdapterFromConfig(refSeqs.data || [])
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
      end: refSeq.end,
      refName: refSeq.name,
      start: refSeq.start,
      uniqueId: refSeq.name,
    }),
  )
  return {
    features,
    type: 'FromConfigAdapter',
  }
}
