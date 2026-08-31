import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type { KeyedRenderingBackend } from '@jbrowse/render-core/keyedRenderingBackend'

export interface SyntenyTrackRenderParams {
  /** y offset (CSS px) from the top of the canvas to the top of this track */
  yTop: number
  /** drawable height (CSS px) of this track */
  height: number
  /** Track-wide opacity. A render parameter, NOT part of the packed color — an
   * opacity drag must not invalidate `computedColors` (which would recompute,
   * re-pack and re-upload every instance per frame). The shader multiplies it in
   * `fillShade`; `resolveInstanceFill` is the Canvas2D twin. Dotplot's
   * `DotplotRenderState.alpha` is the same split. */
  alpha: number
  /** Fade sub-pixel-thin ribbons by on-screen width; off keeps full alpha. */
  fadeThinAlignments: boolean
  minAlignmentLength: number
  hoveredFeatureId: number
  clickedFeatureId: number
  /** LGV pan offsets (CSS px). Both backends fold these into the same per-axis
   * `panPx = (base - offsetPx * bpPerPx) / bpPerPx` via `computeTransform`
   * (float64), which is what lets a corner ride the GPU as a single Float32
   * with no hi/lo split — see the header of syntenyTypes.slang. */
  offsetPx0: number
  offsetPx1: number
  bpPerPx0: number
  bpPerPx1: number
  drawCurves: boolean
}

export interface SyntenyRenderState {
  overdrawPx: number
  /**
   * What both backends clear the band to, and the colour every fill is
   * calibrated against — the page theme's `background.paper`. The band's, not a
   * track's: `render` paints it with an empty `perTrack` too, which is the one
   * frame where it is the only thing drawn. `Canvas2DSyntenyRenderer.clear`
   * carries why an indel wedge and the base ribbon beside it agree only over a
   * known ground, and `getContrastText` of this is the ink drawn onto it.
   */
  groundColor: string
  /** Per-track render parameters keyed parallel to uploaded geometry. */
  perTrack: Map<number, SyntenyTrackRenderParams>
}

export interface SyntenyPickResult {
  key: number
  instanceIndex: number
}

/**
 * A keyed shared-canvas backend: one canvas, a key per track level.
 *
 * `render` repaints the whole band — clear, then draw every key in `perTrack`
 * that has geometry. Unconditional: an empty `perTrack` (no synteny track on
 * this row pair, or the one it had was hidden) paints the background alone,
 * which is what erases the departed track. Nothing else repaints this canvas.
 */
export interface SyntenyRenderingBackend extends KeyedRenderingBackend<
  SyntenyInstanceData,
  SyntenyRenderState
> {
  // Pick takes the current render state explicitly — no stale-snapshot
  // coupling with the last render() call. Callers read state from the model
  // (the same getter that feeds render) and pass it in.
  pick(
    x: number,
    y: number,
    state: SyntenyRenderState,
  ): SyntenyPickResult | undefined
}
