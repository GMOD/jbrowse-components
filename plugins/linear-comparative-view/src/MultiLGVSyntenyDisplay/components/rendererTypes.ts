import type { SyntenyRegionData } from '../../LinearSyntenyRPC/syntenyRegionTypes.ts'
import type { SyntenyColorPalette } from '../shared/types.ts'
import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'

export type { RenderBlock as MultiSyntenyRenderBlock } from '@jbrowse/core/gpu/renderBlock'

// Per-frame render state. Block geometry comes via the blocks argument to
// renderBlocks, mirroring AlignmentsBackend / WiggleBackend / VariantBackend.
export interface MultiSyntenyRenderState {
  canvasWidth: number
  canvasHeight: number
  rowHeight: number
  rowSpacing: boolean
  coverageHeight: number
  palette: SyntenyColorPalette
  displayedGenomes: string[]
  labelW: number
}

// Settings consumed during main-thread GPU buffer encoding (the
// `gpuProps` half of the rpcProps/gpuProps split documented in
// agent-docs/ARCHITECTURE.md). Anything that affects packed buffers but
// does NOT trigger an RPC refetch goes here.
export interface MultiSyntenyGpuProps {
  displayedGenomes: string[]
  colorBy: string
  showSnps: boolean
  showCoverage: boolean
  coverageGlobalMax: number
  viewWidth: number
}

// Sources passed to `sync()`. Mirrors AlignmentsSources: the model hands
// the backend the full RPC payload plus the gpuProps that drive packing.
export interface MultiSyntenySources {
  rpcDataMap: ReadonlyMap<number, SyntenyRegionData>
  gpuProps: MultiSyntenyGpuProps
  palette: SyntenyColorPalette
}

export interface MultiSyntenyBackend {
  sync(sources: MultiSyntenySources): void
  renderBlocks(blocks: RenderBlock[], state: MultiSyntenyRenderState): boolean
  dispose(): void
}
