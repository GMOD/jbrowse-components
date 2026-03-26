export const LABEL_WIDTH = 120
export const LABEL_FONT_MAX = 12

import {
  BASE_A_COLOR,
  BASE_C_COLOR,
  BASE_G_COLOR,
  BASE_T_COLOR,
  DELETION_COLOR,
  INSERTION_COLOR,
  MISMATCH_COLOR,
} from '@jbrowse/alignments-core'

import type { MultiSyntenyGpuInstanceData } from './multiSyntenyGpuData.ts'
import type { BaseBlock } from '@jbrowse/core/util/blockTypes'
import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'

export type BpToPxFn = (refName: string, coord: number) => number | undefined

export interface SyntenyColors {
  mismatch: string
  deletion: string
  insertion: string
  baseA: string
  baseC: string
  baseG: string
  baseT: string
}

export const DEFAULT_SYNTENY_COLORS: SyntenyColors = {
  mismatch: MISMATCH_COLOR,
  deletion: DELETION_COLOR,
  insertion: INSERTION_COLOR,
  baseA: BASE_A_COLOR,
  baseC: BASE_C_COLOR,
  baseG: BASE_G_COLOR,
  baseT: BASE_T_COLOR,
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
  render(
    contentBlocks: BaseBlock[],
    viewOffsetPx: number,
    width: number,
    height: number,
    rowHeight: number,
    rowSpacing: boolean,
    labelW: number,
  ): void
  pick(x: number, y: number): number
  dispose(): void
}
