export const LABEL_WIDTH = 120
export const LABEL_FONT_MAX = 12

import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'
import type { MultiSyntenyGpuInstanceData } from './multiSyntenyGpuData.ts'
import type { BaseBlock } from '@jbrowse/core/util/blockTypes'

export type BpToPxFn = (refName: string, coord: number) => number | undefined

export interface MultiSyntenyCanvasRenderOpts {
  width: number
  height: number
  rowHeight: number
  bpToPx: BpToPxFn
  colorBy: string
  labelW: number
  showSnps: boolean
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
    labelW: number,
  ): void
  pick(x: number, y: number): number
  dispose(): void
}
