import type { ArrowData, LineData, RectData } from '../packRenderArrays.ts'
import type { DisplayConfig } from '../renderConfig.ts'
import type {
  AminoAcidOverlayItem,
  FlatbushItem,
  FloatingLabelsDataMap,
  SubfeatureInfo,
} from '../rpcTypes.ts'
import type { PeptideData } from '../types.ts'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'
import type { Feature } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

// Read-only inputs threaded through every emitter: the resolved config, theme,
// colorByCDS flag, the per-feature translated peptides, and the worker jexl.
export interface RenderContext {
  config: DisplayConfig
  palette: JBrowsePalette
  colorByCDS: boolean
  peptideDataMap?: Map<string, PeptideData>
  // worker pluginManager's jexl instance, so a custom `mouseover` slot can call
  // plugin-registered jexl functions. Undefined in tests → default instance.
  jexl: JexlInstance
}

// Where one glyph draws and what it belongs to — the four values every glyph
// handler needs and none of them derives: the row offset it emits at, the
// hit-test entry its primitives are attributed to, whether it is the top-level
// feature (only that one fades on collapse and skips subfeature registration),
// and the feature that owns it.
//
// One object rather than four positional arguments, because `baseTopPx` and
// `flatbushIdx` are both plain numbers and the handlers had them in three
// different orders — adjacent in two of them, where swapping the pair
// typechecked and would have drawn every primitive at the wrong row while
// attributing it to a feature that isn't there.
export interface GlyphPlacement {
  baseTopPx: number
  flatbushIdx: number
  isRoot: boolean
  parentFeature: Feature
}

// Mutable accumulator the emitters push into; packed into typed arrays once all
// features are processed.
export interface Collector {
  rects: RectData[]
  lines: LineData[]
  arrows: ArrowData[]
  floatingLabelsData: FloatingLabelsDataMap
  flatbushItems: FlatbushItem[]
  subfeatureInfos: SubfeatureInfo[]
  aminoAcidOverlay: AminoAcidOverlayItem[]
}

export function createCollector(): Collector {
  return {
    rects: [],
    lines: [],
    arrows: [],
    floatingLabelsData: {},
    flatbushItems: [],
    subfeatureInfos: [],
    aminoAcidOverlay: [],
  }
}
