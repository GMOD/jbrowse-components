export const LABEL_WIDTH = 120
export const LABEL_FONT_MAX = 12

import type { CigarOpDrawColors } from '@jbrowse/alignments-core'
import type {
  BlockGeometryData,
  BlockCoverageUploadData,
} from './multiSyntenyGpuData.ts'
import type { BaseBlock } from '@jbrowse/core/util/blockTypes'
import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'

export type BpToPxFn = (refName: string, coord: number) => number | undefined

export type SyntenyColors = CigarOpDrawColors

export interface CanvasCoverageData {
  coverageDepths: Float32Array
  coverageMaxDepth: number
  coverageStartOffset: number
  coverageRegionStart: number
}

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
  coverage?: CanvasCoverageData
}

export interface MultiSyntenyCanvasBackend {
  resize(width: number, height: number): void
  render(
    genomeRows: Map<string, MultiPairFeature[]>,
    displayedGenomes: string[],
    opts: MultiSyntenyCanvasRenderOpts,
  ): void
  dispose(): void
}

export interface MultiSyntenyGpuBackend {
  resize(width: number, height: number): void
  uploadGeometryForBlock(
    blockKey: string,
    data: BlockGeometryData & { regionStart: number },
  ): void
  uploadCoverageForBlock(
    blockKey: string,
    data: BlockCoverageUploadData & { regionStart: number; maxDepth: number },
  ): void
  clearBlock(blockKey: string): void
  clearAllBlocks(): void
  render(
    contentBlocks: BaseBlock[],
    regionKeyMap: Map<number, string>,
    viewOffsetPx: number,
    width: number,
    height: number,
    rowHeight: number,
    rowSpacing: boolean,
    coverageHeight: number,
    coverageColor?: [number, number, number],
  ): void
  pick(x: number, y: number): number
  dispose(): void
}
