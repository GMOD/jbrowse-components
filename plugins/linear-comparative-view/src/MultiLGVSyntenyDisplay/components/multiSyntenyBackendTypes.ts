import type {
  BlockCoverageUploadData,
  BlockGeometryData,
  BlockIndicatorUploadData,
  BlockSnpUploadData,
} from './multiSyntenyGpuData.ts'
import type { SyntenyRegionData } from '../../LinearSyntenyRPC/syntenyRegionTypes.ts'
import type { SyntenyColorPalette } from '../model.ts'
import type { CigarOpDrawColors } from '@jbrowse/alignments-core'
import type { BaseBlock } from '@jbrowse/core/util/blockTypes'

export const LABEL_WIDTH = 120
export const LABEL_FONT_MAX = 12

export const BG_COLOR_HEX = '#ededed'
export const BG_COLOR_GL = 0.93

export function truncateGenomeName(name: string) {
  return name.length > 15 ? `${name.slice(0, 12)}...` : name
}

export type BpToPxFn = (refName: string, coord: number) => number | undefined

export type SyntenyColors = CigarOpDrawColors

export interface MultiSyntenyRenderState {
  contentBlocks: BaseBlock[]
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
    regionNumber: number,
    data: BlockGeometryData & { regionStart: number },
  ): void
  uploadCoverageForBlock(
    regionNumber: number,
    data: BlockCoverageUploadData & { regionStart: number; maxDepth: number },
  ): void
  uploadSnpCoverageForBlock(
    regionNumber: number,
    data: BlockSnpUploadData,
  ): void
  uploadIndicatorsForBlock(
    regionNumber: number,
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
