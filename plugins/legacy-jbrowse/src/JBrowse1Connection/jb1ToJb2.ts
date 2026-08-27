import { matchFormat, trackTypeForAdapter } from '@jbrowse/add-track-core'
import { objectHash } from '@jbrowse/core/util'
import {
  generateUnknownTrackConf,
  generateUnsupportedTrackConf,
} from '@jbrowse/core/util/tracks'

import type { Track } from './types.ts'
import type { AdapterSpec } from '@jbrowse/add-track-core'

interface Jb2Track {
  trackId: string
  name: string
  description?: string
  category?: string[]
  adapter?: Jb2Adapter
  type?: string
  displays?: { type: string; displayId: string; defaultRendering: string }[]
}

interface Jb2Adapter {
  [key: string]: unknown
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
  bedLocation?: Jb2Location
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

/**
 * The JBrowse 2 adapter each JBrowse 1 storeClass becomes, keyed by the part
 * after `JBrowse/Store/`. This is the only JBrowse-1-specific knowledge here:
 * which location field an adapter stores its file under, and what it names the
 * index or sidecar beside it, comes from `@jbrowse/add-track-core`'s format
 * table — the one the add-track form and the CLI already read. A hand-written
 * branch per store is what let one of three sequence stores drift into calling
 * its track a `SequenceTrack`, a type JBrowse does not register.
 */
const STORE_ADAPTERS: Record<string, string | AdapterSpec> = {
  'SeqFeature/BAM': 'BamAdapter',
  'SeqFeature/CRAM': 'CramAdapter',
  'SeqFeature/NCList': 'NCListAdapter',
  'SeqFeature/BigWig': 'BigWigAdapter',
  BigWig: 'BigWigAdapter',
  'SeqFeature/BigBed': 'BigBedAdapter',
  'SeqFeature/VCFTabix': 'VcfTabixAdapter',
  'SeqFeature/GFF3': 'Gff3Adapter',
  'SeqFeature/GFF3Tabix': 'Gff3TabixAdapter',
  'SeqFeature/GTF': 'GtfAdapter',
  'SeqFeature/BED': 'BedAdapter',
  'SeqFeature/BEDTabix': 'BedTabixAdapter',
  'SeqFeature/TwoBit': 'TwoBitAdapter',
  'SeqFeature/IndexedFasta': 'IndexedFastaAdapter',
  'SeqFeature/BgzipIndexedFasta': 'BgzipFastaAdapter',
  // nothing guesses a plain `.fa` as unindexed, so this is the one store whose
  // spec the format table cannot supply
  'SeqFeature/UnindexedFasta': {
    kind: 'single',
    adapterType: 'UnindexedFastaAdapter',
    locField: 'fastaLocation',
  },
}

// JBrowse 1 stores JBrowse 2 has no adapter for. The value names the format in
// the placeholder track the reader gets instead.
const NO_ADAPTER: Record<string, string> = {
  'SeqFeature/VCFTribble': 'VCFTribble',
  'SeqFeature/StaticChunked': 'StaticChunked',
  'Sequence/StaticChunked': 'StaticChunked',
}

/**
 * `defaultRendering` is a slot on LinearWiggleDisplay, not on the track — a
 * track-level one is a key JBrowse does not declare, and is ignored.
 */
function wiggleDisplays(jb1TrackConfig: Track, jb2TrackConfig: Jb2Track) {
  const rendering = jb1TrackConfig.type?.endsWith('Density')
    ? 'density'
    : jb1TrackConfig.type?.endsWith('XYPlot')
      ? 'xyplot'
      : undefined
  return rendering
    ? [
        {
          type: 'LinearWiggleDisplay',
          displayId: `${jb2TrackConfig.trackId}-LinearWiggleDisplay`,
          defaultRendering: rendering,
        },
      ]
    : undefined
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

  const unsupported = (detail: string) =>
    generateUnsupportedTrackConf(
      jb2TrackConfig.name,
      detail,
      jb2TrackConfig.category,
    )

  const { storeClass } = jb1TrackConfig
  if (!jb1TrackConfig.urlTemplate) {
    if (!storeClass?.endsWith('FromConfig')) {
      const trackIdentifier = jb1TrackConfig.key || jb1TrackConfig.label
      console.warn(
        `Could not import JBrowse1 track "${trackIdentifier}" because it does not have a "urlTemplate" or is not a "FromConfig" track`,
      )
      return unsupported(trackIdentifier)
    }
    return generateFromConfigTrackConfig(jb1TrackConfig, jb2TrackConfig)
  }

  // a JBrowse 1 urlTemplate is relative to the data directory, and NCList's
  // `{refseq}` has to survive the round trip through URL escaping
  const resolve = (urlTemplate: string) =>
    new URL(urlTemplate, `${dataRoot}/`).href
      .replaceAll(/%7B/gi, '{')
      .replaceAll(/%7D/gi, '}')

  const urlTemplate = resolve(jb1TrackConfig.urlTemplate)
  const fileName = urlTemplate.split(/[?#]/)[0]!
  const loc = (uri: string): Jb2Location => ({
    uri,
    locationType: 'UriLocation',
  })

  const key = storeClass?.replace(/^JBrowse\/Store\//, '')
  const noAdapter = key === undefined ? undefined : NO_ADAPTER[key]
  if (noAdapter) {
    return unsupported(`${noAdapter} (${urlTemplate})`)
  }

  // JBrowse 1 named an override for a sidecar after its own suffix, so `.bai`
  // is `baiUrlTemplate` and `.gzi` is `gziUrlTemplate`
  const named = (suffix: string) =>
    jb1TrackConfig[`${suffix.slice(1)}UrlTemplate`] as string | undefined

  const beside = (suffix: string) => {
    const override = named(suffix)
    return loc(override ? resolve(override) : `${urlTemplate}${suffix}`)
  }

  const entry =
    key === undefined
      ? undefined
      : typeof STORE_ADAPTERS[key] === 'string'
        ? matchFormat(fileName, STORE_ADAPTERS[key])?.spec
        : STORE_ADAPTERS[key]

  // an unrecognized storeClass, or none, falls back to what the filename says
  const spec = entry ?? matchFormat(fileName)?.spec
  if (!spec || spec.kind === 'unsupported') {
    return spec
      ? unsupported(urlTemplate)
      : generateUnknownTrackConf(
          jb2TrackConfig.name,
          urlTemplate,
          jb2TrackConfig.category,
        )
  }

  const adapter: Jb2Adapter = {
    type: spec.adapterType,
    [spec.locField]: loc(urlTemplate),
  }
  if (spec.kind === 'indexed') {
    const csi = jb1TrackConfig.csiUrlTemplate
    adapter.index =
      !named(spec.suffix) && csi
        ? { location: loc(resolve(csi)), indexType: 'CSI' }
        : { location: beside(spec.suffix) }
  } else if (spec.kind === 'sidecar') {
    for (const { field, suffix } of spec.sidecars) {
      adapter[field] = beside(suffix)
    }
  }
  jb2TrackConfig.adapter = adapter

  jb2TrackConfig.type =
    trackTypeForAdapter(spec.adapterType, fileName) ?? 'FeatureTrack'

  if (jb2TrackConfig.type === 'QuantitativeTrack') {
    jb2TrackConfig.displays = wiggleDisplays(jb1TrackConfig, jb2TrackConfig)
  }

  return jb2TrackConfig
}

function generateFromConfigTrackConfig(
  jb1TrackConfig: Track,
  jb2TrackConfig: Jb2Track,
): Jb2Track {
  const jb1Features = jb1TrackConfig.features ?? []
  const features = jb1Features.map((f): Jb2Feature => ({
    refName: f.seq_id,
    uniqueId: `${f.seq_id}:${f.start}-${f.end}:${f.name ?? ''}`,
    start: f.start,
    end: f.end,
  }))
  return {
    ...jb2TrackConfig,
    type: 'FeatureTrack',
    adapter: { type: 'FromConfigAdapter', features },
  }
}
