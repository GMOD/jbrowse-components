export const LABEL_WIDTH = 120
export const LABEL_FONT_MAX = 12

// Background gray shared across GPU and Canvas2D renderers.
// 0xed/255 ≈ 0.929; GPU uses the float form, Canvas2D uses the hex form.
export const BG_COLOR_HEX = '#ededed'
export const BG_COLOR_GL = 0.93

export function truncateGenomeName(name: string) {
  return name.length > 15 ? `${name.slice(0, 12)}...` : name
}

import type { CigarOpDrawColors } from '@jbrowse/alignments-core'
import type {
  BlockGeometryData,
  BlockCoverageUploadData,
  BlockSnpUploadData,
} from './multiSyntenyGpuData.ts'
import type { SyntenyColorPalette } from '../model.ts'
import type { SyntenyRegionData } from '../../LinearSyntenyRPC/syntenyRegionTypes.ts'
import type { BaseBlock } from '@jbrowse/core/util/blockTypes'
import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'

export type BpToPxFn = (refName: string, coord: number) => number | undefined

export type SyntenyColors = CigarOpDrawColors

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
  coverage?: SyntenyRegionData
  coverageColor: string
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
  clearBlock(regionNumber: number): void
  clearAllBlocks(): void
  render(
    contentBlocks: BaseBlock[],
    viewOffsetPx: number,
    width: number,
    height: number,
    rowHeight: number,
    rowSpacing: boolean,
    coverageHeight: number,
    palette: SyntenyColorPalette,
  ): void
  pick(x: number, y: number): number
  dispose(): void
}
