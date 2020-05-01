import { openLocation } from '@gmod/jbrowse-core/util/io'
import objectHash from 'object-hash'
import {
  generateUnknownTrackConf,
  generateUnsupportedTrackConf,
  guessAdapter,
  guessTrackType,
  UNKNOWN,
  UNSUPPORTED,
} from '@gmod/jbrowse-core/util/tracks'
import { JBLocation, Track, RefSeqs, RefSeq } from './types'

interface Jb2Track {
  trackId: string
  name: string
  description?: string
  category?: string[]
  adapter?: Jb2Adapter
  type?: string
  renderer?: Jb2Renderer
  defaultRendering?: string
}

interface Jb2Adapter {
  type: string
  features?: Jb2Feature[]
  bamLocation?: Jb2Location
  cramLocation?: JBLocation
  craiLocation?: JBLocation
  fastaLocation?: Jb2Location
  faiLocation?: Jb2Location
  gziLocation?: Jb2Location
  twoBitLocation?: Jb2Location
  bigWigLocation?: Jb2Location
  bigBedLocation?: Jb2Location
  vcfGzLocation?: Jb2Location
  index?: { location: Jb2Location; indexType?: string }
  rootUrlTemplate?: string
  sequenceAdapter?: Jb2Adapter
}

interface Jb2Renderer {
  type: string
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
  blob?: Blob
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
  if (description) jb2TrackConfig.description = description

  const category =
    jb1TrackConfig.category ||
    (jb1TrackConfig.metadata && jb1TrackConfig.metadata.category)
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
      .replace(/%7B/gi, '{')
      .replace(/%7D/gi, '}')
  }
  const urlTemplate = resolveUrlTemplate(jb1TrackConfig.urlTemplate)

  if (storeClass) {
    if (storeClass === 'JBrowse/Store/SeqFeature/BAM') {
      const adapter: Jb2Adapter = {
        type: 'BamAdapter',
        bamLocation: { uri: urlTemplate },
      }
      if (jb1TrackConfig.baiUrlTemplate)
        adapter.index = {
          location: { uri: resolveUrlTemplate(jb1TrackConfig.baiUrlTemplate) },
        }
      else if (jb1TrackConfig.csiUrlTemplate)
        adapter.index = {
          location: { uri: resolveUrlTemplate(jb1TrackConfig.csiUrlTemplate) },
          indexType: 'CSI',
        }
      else adapter.index = { location: { uri: `${urlTemplate}.bai` } }
      return {
        ...jb2TrackConfig,
        type: 'PileupTrack',
        adapter,
      }
    }
    if (storeClass === 'JBrowse/Store/SeqFeature/CRAM') {
      const adapter: Jb2Adapter = {
        type: 'CramAdapter',
        cramLocation: { uri: urlTemplate },
        sequenceAdapter,
      }
      if (jb1TrackConfig.craiUrlTemplate)
        adapter.craiLocation = {
          uri: resolveUrlTemplate(jb1TrackConfig.craiUrlTemplate),
        }
      else adapter.craiLocation = { uri: `${urlTemplate}.crai` }
      return {
        ...jb2TrackConfig,
        type: 'PileupTrack',
        adapter,
      }
    }
    if (storeClass === 'JBrowse/Store/SeqFeature/NCList') {
      return {
        ...jb2TrackConfig,
        type: 'BasicTrack',
        adapter: { type: 'NCListAdapter', rootUrlTemplate: urlTemplate },
        renderer: { type: 'SvgFeatureRenderer' },
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
        type: 'WiggleTrack',
        adapter: {
          type: 'BigWigAdapter',
          bigWigLocation: { uri: urlTemplate },
        },
      }
    }
    if (storeClass === 'JBrowse/Store/SeqFeature/VCFTabix') {
      const adapter: Jb2Adapter = {
        type: 'VcfTabixAdapter',
        vcfGzLocation: { uri: urlTemplate },
      }
      if (jb1TrackConfig.tbiUrlTemplate)
        adapter.index = {
          location: { uri: resolveUrlTemplate(jb1TrackConfig.tbiUrlTemplate) },
        }
      else if (jb1TrackConfig.csiUrlTemplate)
        adapter.index = {
          location: { uri: resolveUrlTemplate(jb1TrackConfig.csiUrlTemplate) },
          indexType: 'CSI',
        }
      else adapter.index = { location: { uri: `${urlTemplate}.tbi` } }
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
      return generateUnsupportedTrackConf(
        jb2TrackConfig.name,
        `GFF3 (${urlTemplate})`,
        jb2TrackConfig.category,
      )
    }
    if (storeClass === 'JBrowse/Store/SeqFeature/BigBed') {
      return {
        ...jb2TrackConfig,
        type: 'BasicTrack',
        adapter: {
          type: 'BigBedAdapter',
          bigBedLocation: { uri: urlTemplate },
        },
      }
    }
    if (storeClass === 'JBrowse/Store/SeqFeature/GFF3Tabix') {
      return generateUnsupportedTrackConf(
        jb2TrackConfig.name,
        `GFF3Tabix (${urlTemplate})`,
        jb2TrackConfig.category,
      )
    }
    if (storeClass === 'JBrowse/Store/SeqFeature/BED') {
      return generateUnsupportedTrackConf(
        jb2TrackConfig.name,
        `BED (${urlTemplate})`,
        jb2TrackConfig.category,
      )
    }
    if (storeClass === 'JBrowse/Store/SeqFeature/BEDTabix') {
      return generateUnsupportedTrackConf(
        jb2TrackConfig.name,
        `BEDTabix (${urlTemplate})`,
        jb2TrackConfig.category,
      )
    }
    if (storeClass === 'JBrowse/Store/SeqFeature/GTF') {
      return generateUnsupportedTrackConf(
        jb2TrackConfig.name,
        `GTF (${urlTemplate})`,
        jb2TrackConfig.category,
      )
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
        fastaLocation: { uri: urlTemplate },
      }
      if (jb1TrackConfig.faiUrlTemplate)
        adapter.faiLocation = {
          uri: resolveUrlTemplate(jb1TrackConfig.faiUrlTemplate),
        }
      else adapter.faiLocation = { uri: `${urlTemplate}.fai` }
      return {
        ...jb2TrackConfig,
        type: 'SequenceTrack',
        adapter,
      }
    }
    if (storeClass === 'JBrowse/Store/SeqFeature/BgzipIndexedFasta') {
      const adapter: Jb2Adapter = {
        type: 'BgzipFastaAdapter',
        fastaLocation: { uri: urlTemplate },
      }
      if (jb1TrackConfig.faiUrlTemplate)
        adapter.faiLocation = {
          uri: resolveUrlTemplate(jb1TrackConfig.faiUrlTemplate),
        }
      else adapter.faiLocation = { uri: `${urlTemplate}.fai` }
      if (jb1TrackConfig.gziUrlTemplate)
        adapter.gziLocation = {
          uri: resolveUrlTemplate(jb1TrackConfig.gziUrlTemplate),
        }
      else adapter.gziLocation = { uri: `${urlTemplate}.gzi` }
      return {
        ...jb2TrackConfig,
        type: 'SequenceTrack',
        adapter,
      }
    }
    if (storeClass === 'JBrowse/Store/SeqFeature/TwoBit') {
      return {
        ...jb2TrackConfig,
        type: 'SequenceTrack',
        adapter: {
          type: 'TwoBitAdapter',
          twoBitLocation: { uri: urlTemplate },
        },
      }
    }
  }

  // If we don't recogize the store class, make a best effort to guess by file type
  jb2TrackConfig.adapter = guessAdapter(urlTemplate, 'uri')
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

  if (jb2TrackConfig.type === 'WiggleTrack') {
    if (jb1TrackConfig.type && jb1TrackConfig.type.endsWith('XYPlot')) {
      jb2TrackConfig.defaultRendering = 'xyplot'
    } else if (jb1TrackConfig.type && jb1TrackConfig.type.endsWith('Density')) {
      jb2TrackConfig.defaultRendering = 'density'
    }
  } else if (jb2TrackConfig.type === 'BasicTrack') {
    jb2TrackConfig.renderer = {
      type: 'SvgFeatureRenderer',
    }
  }

  return jb2TrackConfig
}

function generateFromConfigTrackConfig(
  jb1TrackConfig: Track,
  jb2TrackConfig: Jb2Track,
): Jb2Track {
  const jb1Features = jb1TrackConfig.features || []
  const jb2Features = jb1Features.map(
    (feature): Jb2Feature => {
      const jb2Feature: Jb2Feature = JSON.parse(JSON.stringify(feature))
      jb2Feature.refName = feature.seq_id
      jb2Feature.uniqueId = `${feature.seq_id}:${feature.start}-${
        feature.end
      }:${feature.name || ''}`
      return jb2Feature
    },
  )
  jb2TrackConfig.adapter = {
    type: 'FromConfigAdapter',
    features: jb2Features,
  }
  jb2TrackConfig.type = 'BasicTrack'
  jb2TrackConfig.renderer = {
    type: 'SvgFeatureRenderer',
  }
  return jb2TrackConfig
}

export async function createRefSeqsAdapter(
  refSeqs: string | RefSeqs,
): Promise<Jb2Adapter> {
  if (typeof refSeqs == 'string') {
    // assume refSeqs is a url if it is string
    refSeqs = {
      url: refSeqs,
    }
  }

  // check refseq urls
  if (refSeqs.url) {
    if (refSeqs.url.match(/.fai$/)) {
      return {
        type: 'IndexedFastaAdapter',
        fastaLocation: {
          uri: refSeqs.url.slice(0, -4),
        },
        faiLocation: {
          uri: refSeqs.url,
        },
      }
    }
    if (refSeqs.url.match(/.2bit$/)) {
      return {
        type: 'TwoBitAdapter',
        twoBitLocation: { uri: refSeqs.url },
      }
    }
    if (refSeqs.url.match(/.fa$/)) {
      throw new Error('Unindexed FASTA adapter not available')
    }
    if (refSeqs.url.match(/.sizes/)) {
      throw new Error('chromosome SIZES adapter not available')
    }
    const refSeqsJson = await openLocation({ uri: refSeqs.url }).readFile(
      'utf8',
    )
    const refSeqsData: RefSeq[] = JSON.parse(refSeqsJson as string)
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
