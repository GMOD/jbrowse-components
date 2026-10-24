import type { Span } from '../../shared/mergeSpans.ts'
import type { ArrowData, LineData, RectData } from '../packRenderArrays.ts'
import type { DisplayConfig, WorkerColor } from '../renderConfig.ts'
import type {
  AminoAcidOverlayItem,
  TranscriptFeaturesJoin,
  FlatbushItem,
  FloatingLabelsDataMap,
  SubfeatureInfo,
} from '../rpcTypes.ts'
import type { PeptideData } from '../types.ts'
import type { ColorKey } from './colorKey.ts'
import type { Feature } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

// A `transcriptFeatures` row with its blocks merged, as it fits a transcript
export interface AttachableRow {
  feature: Feature
  blocks: Span[]
  // The row's `join.field`, undefined while the track joins by shape alone
  key?: string
}

export interface TranscriptFeatures {
  // One per `transcriptFeatures.tracks` entry, its rows ascending by start.
  // `candidates` and `attached` count what the walk tried and kept, for the
  // notice on a track that fit nothing.
  tracks: {
    trackId: string
    rows: AttachableRow[]
    on: 'cds' | 'exon'
    join: TranscriptFeaturesJoin
    candidates: number
    attached: number
  }[]
  // One color for every track's rows, so they share one key
  color: WorkerColor
}

// The worker resolves no theme color at all — a color that depends on the theme
// ships as a class the main-thread encode fills in, which keeps a light/dark
// toggle out of the RPC cache key.
export interface RenderContext {
  config: DisplayConfig
  colorByFrame: boolean
  peptideDataMap?: Map<string, PeptideData>
  transcriptFeatures?: TranscriptFeatures
  jexl: JexlInstance
  // Reads `config.facetField`, built once per walk.
  readGroupKey?: (feature: Feature) => unknown
  // Reads `config.mouseover`, built once per walk (`tooltipReader`).
  tooltipOf?: (feature: Feature) => string
  isGeneType?: (type: string) => boolean
}

export interface GlyphPlacement {
  baseTopPx: number
  // The other half of `baseTopPx`: the main thread adds
  // `labelRowsAbove × labelFontPx` to every Y emitted here, so a label row is
  // spent in label units rather than scaled with the geometry.
  labelRowsAbove: number
  flatbushIdx: number
  isRoot: boolean
  // The record's ROOT feature at every depth, never the immediate container a
  // nested glyph sits in: the main thread reads the id it registers under as the
  // top-level id, and a nested glyph naming its container instead silently loses
  // its hover, its row offset, and its floating label.
  parentFeature: Feature
}

export interface Collector {
  rects: RectData[]
  lines: LineData[]
  arrows: ArrowData[]
  floatingLabelsData: FloatingLabelsDataMap
  flatbushItems: FlatbushItem[]
  subfeatureInfos: SubfeatureInfo[]
  aminoAcidOverlay: AminoAcidOverlayItem[]
  colorKey?: ColorKey
  domainColorKey?: ColorKey
}

export function createCollector(
  colorKey?: ColorKey,
  domainColorKey?: ColorKey,
): Collector {
  return {
    rects: [],
    lines: [],
    arrows: [],
    floatingLabelsData: new Map(),
    flatbushItems: [],
    subfeatureInfos: [],
    aminoAcidOverlay: [],
    colorKey,
    domainColorKey,
  }
}
