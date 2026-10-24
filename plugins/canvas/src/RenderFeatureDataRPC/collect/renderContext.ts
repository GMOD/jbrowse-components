import type { ArrowData, LineData, RectData } from '../packRenderArrays.ts'
import type { DisplayConfig, WorkerColor } from '../renderConfig.ts'
import type {
  AminoAcidOverlayItem,
  FlatbushItem,
  FloatingLabelsDataMap,
  SubfeatureInfo,
} from '../rpcTypes.ts'
import type { PeptideData } from '../types.ts'
import type { ColorKey } from './colorKey.ts'
import type { Feature } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

export interface DomainData {
  feature: Feature
  blocks: { start: number; end: number }[]
}

export interface ProteinFeatures {
  byTranscript: Map<string, DomainData[]>
  color: WorkerColor
  // The transcript field `byTranscript`'s keys equal.
  transcriptKey: string
}

// The worker resolves no theme color at all — a color that depends on the theme
// ships as a class the main-thread encode fills in, which keeps a light/dark
// toggle out of the RPC cache key.
export interface RenderContext {
  config: DisplayConfig
  colorByFrame: boolean
  peptideDataMap?: Map<string, PeptideData>
  proteinFeatures?: ProteinFeatures
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
