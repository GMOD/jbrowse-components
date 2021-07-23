import { Track, RefSeqs, RefSeq } from './types'

export const UNKNOWN = 'UNKNOWN'
export const UNSUPPORTED = 'UNSUPPORTED'

export function guessAdapter(
  file: any,
  index: any | undefined,
  getFileName: (f: any) => string,
  adapterHint?: string,
) {
  function makeIndex(location: any, suffix: string) {
    if ('uri' in location) {
      return { uri: location.uri + suffix }
    }
    if ('localPath' in location) {
      return { localPath: location.localPath + suffix }
    }
    return location
  }

  const fileName = getFileName(file)
  const indexName = index && getFileName(index)
  function makeIndexType(
    name: string | undefined,
    typeA: string,
    typeB: string,
  ) {
    return name?.toUpperCase().endsWith(typeA) ? typeA : typeB
  }

  if (/\.bam$/i.test(fileName) || adapterHint === 'BamAdapter') {
    return {
      type: 'BamAdapter',
      bamLocation: file,
      index: {
        location: index || makeIndex(file, '.bai'),
        indexType: makeIndexType(indexName, 'CSI', 'BAI'),
      },
    }
  }

  if (/\.cram$/i.test(fileName) || adapterHint === 'CramAdapter') {
    return {
      type: 'CramAdapter',
      cramLocation: file,
      craiLocation: index || makeIndex(file, '.crai'),
    }
  }

  if (/\.gff3?$/i.test(fileName)) {
    return {
      type: 'UNSUPPORTED',
    }
  }

  if (/\.gff3?\.b?gz$/i.test(fileName) || adapterHint === 'Gff3TabixAdapter') {
    return {
      type: 'Gff3TabixAdapter',
      gffGzLocation: file,
      index: {
        location: index || makeIndex(file, '.tbi'),
        indexType: makeIndexType(indexName, 'CSI', 'TBI'),
      },
    }
  }

  if (/\.gtf?$/i.test(fileName)) {
    return {
      type: 'UNSUPPORTED',
    }
  }

  if (/\.vcf$/i.test(fileName)) {
    return {
      type: 'VcfAdapter',
      vcfLocation: file,
    }
  }

  if (/\.vcf\.b?gz$/i.test(fileName) || adapterHint === 'VcfTabixAdapter') {
    return {
      type: 'VcfTabixAdapter',
      vcfGzLocation: file,
      index: {
        location: index || makeIndex(file, 'tbi'),
        indexType: makeIndexType(indexName, 'CSI', 'TBI'),
      },
    }
  }

  if (/\.vcf\.idx$/i.test(fileName)) {
    return {
      type: 'UNSUPPORTED',
    }
  }

  if (/\.bed$/i.test(fileName)) {
    return {
      type: 'UNSUPPORTED',
    }
  }

  if (/\.bed\.b?gz$/i.test(fileName) || adapterHint === 'BedTabixAdapter') {
    return {
      type: 'BedTabixAdapter',
      bedGzLocation: file,
      index: {
        location: index || makeIndex(file, '.tbi'),
        indexType: makeIndexType(indexName, 'CSI', 'TBI'),
      },
    }
  }

  if (/\.(bb|bigbed)$/i.test(fileName) || adapterHint === 'BigBedAdapter') {
    return {
      type: 'BigBedAdapter',
      bigBedLocation: file,
    }
  }

  if (/\.(bw|bigwig)$/i.test(fileName) || adapterHint === 'BigWigAdapter') {
    return {
      type: 'BigWigAdapter',
      bigWigLocation: file,
    }
  }

  if (
    /\.(fa|fasta|fas|fna|mfa)$/i.test(fileName) ||
    adapterHint === 'IndexedFastaAdapter'
  ) {
    return {
      type: 'IndexedFastaAdapter',
      fastaLocation: file,
      faiLocation: index || makeIndex(file, '.fai'),
    }
  }

  if (
    /\.(fa|fasta|fas|fna|mfa)\.b?gz$/i.test(fileName) ||
    adapterHint === 'BgzipFastaAdapter'
  ) {
    return {
      type: 'BgzipFastaAdapter',
      fastaLocation: file,
      faiLocation: makeIndex(file, '.fai'),
      gziLocation: makeIndex(file, '.gzi'),
    }
  }

  if (/\.2bit$/i.test(fileName) || adapterHint === 'TwoBitAdapter') {
    return {
      type: 'TwoBitAdapter',
      twoBitLocation: file,
    }
  }

  if (/\.sizes$/i.test(fileName)) {
    return {
      type: 'UNSUPPORTED',
    }
  }

  if (
    /\/trackData.jsonz?$/i.test(fileName) ||
    adapterHint === 'NCListAdapter'
  ) {
    return {
      type: 'NCListAdapter',
      rootUrlTemplate: file,
    }
  }

  if (/\/sparql$/i.test(fileName) || adapterHint === 'SPARQLAdapter') {
    return {
      type: 'SPARQLAdapter',
      endpoint: file,
    }
  }

  if (/\.hic/i.test(fileName) || adapterHint === 'HicAdapter') {
    return {
      type: 'HicAdapter',
      hicLocation: file,
    }
  }

  if (/\.paf/i.test(fileName) || adapterHint === 'PAFAdapter') {
    return {
      type: 'PAFAdapter',
      pafLocation: file,
    }
  }

  return {
    type: UNKNOWN,
  }
}

export function guessTrackType(adapterType: string): string {
  const known: { [key: string]: string | undefined } = {
    BamAdapter: 'AlignmentsTrack',
    CramAdapter: 'AlignmentsTrack',
    BgzipFastaAdapter: 'ReferenceSequenceTrack',
    BigWigAdapter: 'QuantitativeTrack',
    IndexedFastaAdapter: 'ReferenceSequenceTrack',
    TwoBitAdapter: 'ReferenceSequenceTrack',
    VcfAdapter: 'VariantTrack',
    VcfTabixAdapter: 'VariantTrack',
    HicAdapter: 'HicTrack',
    PAFAdapter: 'SyntenyTrack',
  }
  return known[adapterType] || 'FeatureTrack'
}

export function generateUnsupportedTrackConf(
  trackName: string,
  trackUrl: string,
  categories: string[] | undefined,
) {
  const conf = {
    type: 'FeatureTrack',
    name: `${trackName} (Unsupported)`,
    description: `Support not yet implemented for "${trackUrl}"`,
    category: categories,
    trackId: '',
  }
  conf.trackId = objectHash(conf)
  return conf
}

export function generateUnknownTrackConf(
  trackName: string,
  trackUrl: string,
  categories: string[] | undefined,
) {
  const conf = {
    type: 'FeatureTrack',
    name: `${trackName} (Unknown)`,
    description: `Could not determine track type for "${trackUrl}"`,
    category: categories,
    trackId: '',
  }
  conf.trackId = objectHash(conf)
  return conf
}

function generateFromConfigTrackConfig(
  jb1TrackConfig: Track,
  jb2TrackConfig: Jb2Track,
  assemblyNames: string,
): Jb2Track {
  const jb1Features = jb1TrackConfig.features || []
  const jb2Features = jb1Features.map(
    (feature): Jb2Feature => {
      const jb2Feature: Jb2Feature = JSON.parse(JSON.stringify(feature))
      jb2Feature.refName = feature.seq_id
      jb2Feature.assemblyNames = assemblyNames
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
  jb2TrackConfig.type = 'FeatureTrack'
  return jb2TrackConfig
}

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
  gffGzLocation?: Jb2Location
  bedGzLocation?: Jb2Location
  index?: { location: Jb2Location; indexType?: string }
  rootUrlTemplate?: Jb2Location
  sequenceAdapter?: Jb2Adapter
}

interface Jb2Feature {
  refName: string
  uniqueId: string
  assemblyNames: string
  start: number
  end: number
}

interface Jb2Location {
  uri?: string
  localPath?: string
  blobId?: string
}

export function hashCode(str: string) {
  let hash = 0
  if (str.length === 0) {
    return hash
  }
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i)
    hash = (hash << 5) - hash + chr
    hash |= 0 // Convert to 32bit integer
  }
  return hash
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function objectHash(obj: Record<string, any>) {
  return `${hashCode(JSON.stringify(obj))}`
}

export function convertTrackConfig(
  jb1TrackConfig: Track,
  dataRoot: string,
  assemblyNames: string,
  sequenceAdapter: Jb2Adapter,
): Jb2Track {
  const jb2TrackConfig: Jb2Track = {
    trackId: objectHash(jb1TrackConfig),
    name: jb1TrackConfig.key || jb1TrackConfig.label,
  }

  const description =
    jb1TrackConfig.metadata &&
    (jb1TrackConfig.metadata.description || jb1TrackConfig.metadata.Description || jb1TrackConfig.metadata.shortInfo )
  if (description) {
    jb2TrackConfig.description = description
  }

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
    return generateFromConfigTrackConfig(jb1TrackConfig, jb2TrackConfig, assemblyNames)
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
      if (jb1TrackConfig.baiUrlTemplate) {
        adapter.index = {
          location: { uri: resolveUrlTemplate(jb1TrackConfig.baiUrlTemplate) },
        }
      } else if (jb1TrackConfig.csiUrlTemplate) {
        adapter.index = {
          location: { uri: resolveUrlTemplate(jb1TrackConfig.csiUrlTemplate) },
          indexType: 'CSI',
        }
      } else {
        adapter.index = { location: { uri: `${urlTemplate}.bai` } }
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
        cramLocation: { uri: urlTemplate },
        sequenceAdapter,
      }
      if (jb1TrackConfig.craiUrlTemplate) {
        adapter.craiLocation = {
          uri: resolveUrlTemplate(jb1TrackConfig.craiUrlTemplate),
        }
      } else {
        adapter.craiLocation = { uri: `${urlTemplate}.crai` }
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
          rootUrlTemplate: { uri: urlTemplate },
        },
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
        type: 'QuantitativeTrack',
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
      if (jb1TrackConfig.tbiUrlTemplate) {
        adapter.index = {
          location: { uri: resolveUrlTemplate(jb1TrackConfig.tbiUrlTemplate) },
        }
      } else if (jb1TrackConfig.csiUrlTemplate) {
        adapter.index = {
          location: { uri: resolveUrlTemplate(jb1TrackConfig.csiUrlTemplate) },
          indexType: 'CSI',
        }
      } else {
        adapter.index = { location: { uri: `${urlTemplate}.tbi` } }
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
      return generateUnsupportedTrackConf(
        jb2TrackConfig.name,
        `GFF3 (${urlTemplate})`,
        jb2TrackConfig.category,
      )
    }
    if (storeClass === 'JBrowse/Store/SeqFeature/BigBed') {
      return {
        ...jb2TrackConfig,
        type: 'FeatureTrack',
        adapter: {
          type: 'BigBedAdapter',
          bigBedLocation: { uri: urlTemplate },
        },
      }
    }
    if (storeClass === 'JBrowse/Store/SeqFeature/GFF3Tabix') {
      const adapter: Jb2Adapter = {
        type: 'Gff3TabixAdapter',
        gffGzLocation: { uri: urlTemplate },
      }
      if (jb1TrackConfig.tbiUrlTemplate) {
        adapter.index = {
          location: { uri: resolveUrlTemplate(jb1TrackConfig.tbiUrlTemplate) },
        }
      } else if (jb1TrackConfig.csiUrlTemplate) {
        adapter.index = {
          location: { uri: resolveUrlTemplate(jb1TrackConfig.csiUrlTemplate) },
          indexType: 'CSI',
        }
      } else {
        adapter.index = { location: { uri: `${urlTemplate}.tbi` } }
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
        bedGzLocation: { uri: urlTemplate },
      }
      if (jb1TrackConfig.tbiUrlTemplate) {
        adapter.index = {
          location: { uri: resolveUrlTemplate(jb1TrackConfig.tbiUrlTemplate) },
        }
      } else if (jb1TrackConfig.csiUrlTemplate) {
        adapter.index = {
          location: { uri: resolveUrlTemplate(jb1TrackConfig.csiUrlTemplate) },
          indexType: 'CSI',
        }
      } else {
        adapter.index = { location: { uri: `${urlTemplate}.tbi` } }
      }
      return {
        ...jb2TrackConfig,
        type: 'FeatureTrack',
        adapter,
      }
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
      if (jb1TrackConfig.faiUrlTemplate) {
        adapter.faiLocation = {
          uri: resolveUrlTemplate(jb1TrackConfig.faiUrlTemplate),
        }
      } else {
        adapter.faiLocation = { uri: `${urlTemplate}.fai` }
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
        fastaLocation: { uri: urlTemplate },
      }
      if (jb1TrackConfig.faiUrlTemplate) {
        adapter.faiLocation = {
          uri: resolveUrlTemplate(jb1TrackConfig.faiUrlTemplate),
        }
      } else {
        adapter.faiLocation = { uri: `${urlTemplate}.fai` }
      }
      if (jb1TrackConfig.gziUrlTemplate) {
        adapter.gziLocation = {
          uri: resolveUrlTemplate(jb1TrackConfig.gziUrlTemplate),
        }
      } else {
        adapter.gziLocation = { uri: `${urlTemplate}.gzi` }
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
          twoBitLocation: { uri: urlTemplate },
        },
      }
    }
  }

  // If we don't recogize the store class, make a best effort to guess by file type
  jb2TrackConfig.adapter = guessAdapter(
    { uri: urlTemplate },
    undefined,
    () => urlTemplate,
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
