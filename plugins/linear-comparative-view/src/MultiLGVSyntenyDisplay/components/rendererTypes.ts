import type { BlockGeometryData } from './multiSyntenyGpuData.ts'
import type { BlockCoverageUploadData } from '../features/coverage/packGpu.ts'
import type { BlockIndicatorUploadData } from '../features/indicator/packGpu.ts'
import type { BlockSnpUploadData } from '../features/snpCoverage/packGpu.ts'
import type { SyntenyRegionData } from '../../LinearSyntenyRPC/syntenyRegionTypes.ts'
import type { BpToPxFn, SyntenyColors } from '../shared/types.ts'
import type { SyntenyColorPalette } from '../model.ts'
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

export interface MultiSyntenyBackend {
  uploadGeometryForBlock(
    displayedRegionIndex: number,
    data: BlockGeometryData & { regionStart: number },
  ): void
  uploadCoverageForBlock(
    displayedRegionIndex: number,
    data: BlockCoverageUploadData & { regionStart: number; maxDepth: number },
  ): void
  uploadSnpCoverageForBlock(
    displayedRegionIndex: number,
    data: BlockSnpUploadData,
  ): void
  uploadIndicatorsForBlock(
    displayedRegionIndex: number,
    data: BlockIndicatorUploadData,
  ): void
  clearAllBlocks(): void
  renderBlocks(state: MultiSyntenyRenderState): void
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
