import { objectHash } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import {
  generateUnknownTrackConf,
  generateUnsupportedTrackConf,
  guessAdapter,
  guessTrackType,
  UNKNOWN,
  UNSUPPORTED,
} from '@jbrowse/core/util/tracks'
import type { Track, RefSeqs, RefSeq } from './types'

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

  const resolveUrlTemplate = (urlTemplate: string) => {
    return new URL(urlTemplate, `${dataRoot}/`).href
      .replaceAll(/%7B/gi, '{')
      .replaceAll(/%7D/gi, '}')
  }
  const urlTemplate = resolveUrlTemplate(jb1TrackConfig.urlTemplate)

  if (storeClass) {
    if (storeClass === 'JBrowse/Store/SeqFeature/BAM') {
      const adapter: Jb2Adapter = {
        type: 'BamAdapter',
        bamLocation: { uri: urlTemplate, locationType: 'UriLocation' },
      }
      if (jb1TrackConfig.baiUrlTemplate) {
        adapter.index = {
          location: {
            uri: resolveUrlTemplate(jb1TrackConfig.baiUrlTemplate),
            locationType: 'UriLocation',
          },
        }
      } else if (jb1TrackConfig.csiUrlTemplate) {
        adapter.index = {
          location: {
            uri: resolveUrlTemplate(jb1TrackConfig.csiUrlTemplate),
            locationType: 'UriLocation',
          },
          indexType: 'CSI',
        }
      } else {
        adapter.index = {
          location: { uri: `${urlTemplate}.bai`, locationType: 'UriLocation' },
        }
      }
      return {
        ...jb2TrackConfig,
        type: 'AlignmentsTrack',
        adapter,
      }
    }
    if (storeClass === 'JBrowse/Store/SeqFeature/CRAM') {
      const adapter: Jb2Adapter = {
        type: 'CramAdapter',
        cramLocation: { uri: urlTemplate, locationType: 'UriLocation' },
        sequenceAdapter,
      }
      adapter.craiLocation = jb1TrackConfig.craiUrlTemplate
        ? {
            uri: resolveUrlTemplate(jb1TrackConfig.craiUrlTemplate),
            locationType: 'UriLocation',
          }
        : {
            uri: `${urlTemplate}.crai`,
            locationType: 'UriLocation',
          }
      return {
        ...jb2TrackConfig,
        type: 'AlignmentsTrack',
        adapter,
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
      const adapter: Jb2Adapter = {
        type: 'VcfTabixAdapter',
        vcfGzLocation: { uri: urlTemplate, locationType: 'UriLocation' },
      }
      if (jb1TrackConfig.tbiUrlTemplate) {
        adapter.index = {
          location: {
            uri: resolveUrlTemplate(jb1TrackConfig.tbiUrlTemplate),
            locationType: 'UriLocation',
          },
        }
      } else if (jb1TrackConfig.csiUrlTemplate) {
        adapter.index = {
          location: {
            uri: resolveUrlTemplate(jb1TrackConfig.csiUrlTemplate),
            locationType: 'UriLocation',
          },
          indexType: 'CSI',
        }
      } else {
        adapter.index = {
          location: { uri: `${urlTemplate}.tbi`, locationType: 'UriLocation' },
        }
      }
      return {
        ...jb2TrackConfig,
        type: 'VariantTrack',
        adapter,
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
      const adapter: Jb2Adapter = {
        type: 'Gff3TabixAdapter',
        gffGzLocation: { uri: urlTemplate, locationType: 'UriLocation' },
      }
      if (jb1TrackConfig.tbiUrlTemplate) {
        adapter.index = {
          location: {
            uri: resolveUrlTemplate(jb1TrackConfig.tbiUrlTemplate),
            locationType: 'UriLocation',
          },
        }
      } else if (jb1TrackConfig.csiUrlTemplate) {
        adapter.index = {
          location: {
            uri: resolveUrlTemplate(jb1TrackConfig.csiUrlTemplate),
            locationType: 'UriLocation',
          },
          indexType: 'CSI',
        }
      } else {
        adapter.index = {
          location: { uri: `${urlTemplate}.tbi`, locationType: 'UriLocation' },
        }
      }
      return {
        ...jb2TrackConfig,
        type: 'FeatureTrack',
        adapter,
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
        type: 'BedTabixAdapter',
        bedGzLocation: { uri: urlTemplate, locationType: 'UriLocation' },
      }
      if (jb1TrackConfig.tbiUrlTemplate) {
        adapter.index = {
          location: {
            uri: resolveUrlTemplate(jb1TrackConfig.tbiUrlTemplate),
            locationType: 'UriLocation',
          },
        }
      } else if (jb1TrackConfig.csiUrlTemplate) {
        adapter.index = {
          location: {
            uri: resolveUrlTemplate(jb1TrackConfig.csiUrlTemplate),
            locationType: 'UriLocation',
          },
          indexType: 'CSI',
        }
      } else {
        adapter.index = {
          location: { uri: `${urlTemplate}.tbi`, locationType: 'UriLocation' },
        }
      }
      return {
        ...jb2TrackConfig,
        type: 'FeatureTrack',
        adapter,
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
      const adapter: Jb2Adapter = {
        type: 'IndexedFastaAdapter',
        fastaLocation: { uri: urlTemplate, locationType: 'UriLocation' },
      }
      adapter.faiLocation = jb1TrackConfig.faiUrlTemplate
        ? {
            uri: resolveUrlTemplate(jb1TrackConfig.faiUrlTemplate),
            locationType: 'UriLocation',
          }
        : {
            uri: `${urlTemplate}.fai`,
            locationType: 'UriLocation',
          }
      return {
        ...jb2TrackConfig,
        type: 'SequenceTrack',
        adapter,
      }
    }
    if (storeClass === 'JBrowse/Store/SeqFeature/BgzipIndexedFasta') {
      const adapter: Jb2Adapter = {
        type: 'BgzipFastaAdapter',
        fastaLocation: { uri: urlTemplate, locationType: 'UriLocation' },
      }
      adapter.faiLocation = jb1TrackConfig.faiUrlTemplate
        ? {
            uri: resolveUrlTemplate(jb1TrackConfig.faiUrlTemplate),
            locationType: 'UriLocation',
          }
        : {
            uri: `${urlTemplate}.fai`,
            locationType: 'UriLocation',
          }
      adapter.gziLocation = jb1TrackConfig.gziUrlTemplate
        ? {
            uri: resolveUrlTemplate(jb1TrackConfig.gziUrlTemplate),
            locationType: 'UriLocation',
          }
        : {
            uri: `${urlTemplate}.gzi`,
            locationType: 'UriLocation',
          }
      return {
        ...jb2TrackConfig,
        type: 'ReferenceSequenceTrack',
        adapter,
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

  // If we don't recognize the store class, make a best effort to guess by file
  // type
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
    type: 'FromConfigAdapter',
    features: jb2Features,
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
    if (/.fai$/.exec(refSeqs.url)) {
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
    if (/.2bit$/.exec(refSeqs.url)) {
      return {
        type: 'TwoBitAdapter',
        twoBitLocation: { uri: refSeqs.url, locationType: 'UriLocation' },
      }
    }
    if (/.fa$/.exec(refSeqs.url)) {
      throw new Error('Unindexed FASTA adapter not available')
    }
    if (/.sizes/.exec(refSeqs.url)) {
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
