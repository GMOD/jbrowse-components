import type { SyntenyRegionData } from '../../LinearSyntenyRPC/syntenyRegionTypes.ts'
import type {
  BpToPxFn,
  SyntenyColorPalette,
  SyntenyColors,
} from '../shared/types.ts'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'

export interface MultiSyntenyRenderState {
  contentBlocks: ContentBlock[]
  viewOffsetPx: number
  width: number
  height: number
  rowHeight: number
  rowSpacing: boolean
  coverageHeight: number
  palette: SyntenyColorPalette
  displayedGenomes: string[]
  labelW: number
}

// Mirrors alignments' AlignmentsSources: the model hands the backend the
// full RPC payload plus the settings that drive packing; the backend
// internally calls per-feature pack/upload primitives.
export interface MultiSyntenySources {
  rpcDataMap: ReadonlyMap<number, SyntenyRegionData>
  displayedGenomes: string[]
  colorBy: string
  showSnps: boolean
  showCoverage: boolean
  coverageGlobalMax: number
  viewWidth: number
  palette: SyntenyColorPalette
}

export interface MultiSyntenyBackend {
  sync(sources: MultiSyntenySources): void
  renderBlocks(state: MultiSyntenyRenderState): boolean
  dispose(): void
}

// Used by renderMultiSyntenyToCtx (SVG export path)
export interface MultiSyntenyCanvasRenderOpts {
  width: number
  height: number
  rowHeight: number
  rowSpacing: boolean
  bpToPx: BpToPxFn
  colorBy: string
  labelW: number
  showSnps: boolean
  colors: SyntenyColors
  coverageHeight: number
  coverageRegions: SyntenyRegionData[]
  coverageColor: string
}
