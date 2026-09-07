import type { HicColorScheme } from './colorRamp.ts'
import type { PerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'

// What painting a bin actually depends on. Kept separate from the canvas dims
// so `drawHicBlocks` can't be handed a mismatched pair — the SVG export draws
// into a layer of its own size and has no canvas to size.
export interface HicDrawState {
  yScalar: number
  colorMaxScore: number
  useLogScale: boolean
  viewScale: number
  viewOffsetX: number
}

export interface HicRenderState extends HicDrawState {
  canvasWidth: number
  canvasHeight: number
  // The palette, as the name of the scheme rather than its bytes: the mark
  // resolves both the GPU's ramp texture and the painter's fillStyle LUT from
  // it, and the table it resolves to is identity-stable.
  colorScheme: HicColorScheme
}

// `binWidth` rides with the data, not the frame state: it's the px size the
// worker packed `instances` at, so a frame can't scale bins from one payload
// against another's geometry — and it's what keeps `renderState` resolvable
// (a bare getter must never hand back undefined) with no data loaded.
//
// `instances` is already the shader's vertex-buffer layout — see
// `HicDataResult.instances` — so the mark's pack hands it to the HAL untouched
// and the Canvas2D/SVG paths read it at stride.
export interface HicUploadData {
  instances: Float32Array
  numContacts: number
  binWidth: number
}

export type HicRenderingBackend = PerRegionRenderingBackend<
  HicUploadData,
  HicRenderState
>
