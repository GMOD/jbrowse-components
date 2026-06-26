import type { ArrowData, LineData, RectData } from '../packRenderArrays.ts'
import type { DisplayConfig } from '../renderConfig.ts'
import type {
  AminoAcidOverlayItem,
  FlatbushItem,
  FloatingLabelsDataMap,
  SubfeatureInfo,
} from '../rpcTypes.ts'
import type { PeptideData } from '../types.ts'
import type { JBrowseTheme as Theme } from '@jbrowse/core/ui'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

// Read-only inputs threaded through every emitter: the resolved config, theme,
// colorByCDS flag, the per-feature translated peptides, and the worker jexl.
export interface RenderContext {
  config: DisplayConfig
  theme: Theme
  colorByCDS: boolean
  peptideDataMap?: Map<string, PeptideData>
  // worker pluginManager's jexl instance, so a custom `mouseover` slot can call
  // plugin-registered jexl functions. Undefined in tests → default instance.
  jexl?: JexlInstance
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
