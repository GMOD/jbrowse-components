import { openLocation } from '@gmod/jbrowse-core/util/io'
import {
  generateUnknownTrackConf,
  generateUnsupportedTrackConf,
  guessAdapter,
  guessTrackType,
  UNKNOWN,
  UNSUPPORTED,
} from '@gmod/jbrowse-core/util/tracks'

interface Jb2Track {
  configId: string
  name?: string
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
  fastaLocation?: Jb2Location
  faiLocation?: Jb2Location
  twoBitLocation?: Jb2Location
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
): Jb2Track {
  const jb2TrackConfig: Jb2Track = {
    configId: jb1TrackConfig.label,
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

  if (!jb1TrackConfig.urlTemplate) {
    if (
      !(
        jb1TrackConfig.storeClass &&
        jb1TrackConfig.storeClass.endsWith('FromConfig')
      )
    )
      throw new Error(
        `JBrowse1 track "${jb1TrackConfig.key ||
          jb1TrackConfig.label}" must have a "urlTemplate" or be a "FromConfig" track`,
      )
    return generateFromConfigTrackConfig(jb1TrackConfig, jb2TrackConfig)
  }

  const urlTemplate = new URL(jb1TrackConfig.urlTemplate, `${dataRoot}/`).href
    .replace(/%7B/gi, '{')
    .replace(/%7D/gi, '}')
  jb2TrackConfig.adapter = guessAdapter(urlTemplate, 'uri')
  if (!jb2TrackConfig.adapter) throw new Error('Could not determine adapter')

  if (jb2TrackConfig.adapter.type === UNSUPPORTED)
    return generateUnsupportedTrackConf(
      jb2TrackConfig.name,
      urlTemplate,
      jb2TrackConfig.category,
    )
  if (jb2TrackConfig.adapter.type === UNKNOWN)
    return generateUnknownTrackConf(
      jb2TrackConfig.name,
      urlTemplate,
      jb2TrackConfig.category,
    )

  jb2TrackConfig.type = guessTrackType(jb2TrackConfig.adapter.type)

  if (jb2TrackConfig.type === 'WiggleTrack') {
    if (jb1TrackConfig.type && jb1TrackConfig.type.endsWith('XYPlot'))
      jb2TrackConfig.defaultRendering = 'xyplot'
    else if (jb1TrackConfig.type && jb1TrackConfig.type.endsWith('Density'))
      jb2TrackConfig.defaultRendering = 'density'
  } else if (jb2TrackConfig.type === 'BasicTrack')
    jb2TrackConfig.renderer = { type: 'SvgFeatureRenderer' }

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
  jb2TrackConfig.renderer = { type: 'SvgFeatureRenderer' }
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
    `Could not determine adapter for JBrowse1 refSeqs: ${refSeqs.url ||
      JSON.stringify(refSeqs)}`,
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
