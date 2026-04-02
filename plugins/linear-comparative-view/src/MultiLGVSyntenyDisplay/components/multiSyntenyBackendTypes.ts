export const LABEL_WIDTH = 120
export const LABEL_FONT_MAX = 12

import type { CigarOpDrawColors } from '@jbrowse/alignments-core'
import type {
  MultiSyntenyGpuInstanceData,
  SyntenyCoverageData,
} from './multiSyntenyGpuData.ts'
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
  coverageData: SyntenyCoverageData | undefined
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
  uploadGeometry(data: MultiSyntenyGpuInstanceData): void
  uploadCoverage(data: SyntenyCoverageData): void
  render(
    contentBlocks: BaseBlock[],
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
