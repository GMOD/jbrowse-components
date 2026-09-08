import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type { SyntenyOutlineChannels } from './syntenyRibbonMarks.ts'
import type { PerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'
import type { FrameDimensions } from '@jbrowse/render-core/renderingBackendBase'

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

/**
 * What one key on the shared band holds. A track's ribbons and its clicked
 * outline are two cells rather than one, so a selection re-uploads the handful
 * of records the outline traces instead of the track's whole buffer.
 */
export type SyntenyCell =
  | { kind: 'ribbons'; data: SyntenyInstanceData }
  | ({ kind: 'outline' } & SyntenyOutlineChannels)

export interface SyntenyRenderState extends FrameDimensions {
  overdrawPx: number
  /**
   * What the frame clears to, and the colour every fill is calibrated against —
   * the page theme's `background.paper`. The band's, not a track's: the frame is
   * painted with an empty `perTrack` too, which is the one frame where it is the
   * only thing drawn. `syntenyGroundClear` carries why an indel wedge and the
   * base ribbon beside it agree only over a known ground, and `getContrastText`
   * of this is the ink drawn onto it.
   */
  groundColor: string
  /**
   * Per-track render parameters under the key of every cell the track owns — its
   * ribbons and, while a feature is selected, its outline — since a block's
   * `displayedRegionIndex` is what the mark's `params` lens picks by.
   */
  perTrack: Map<number, SyntenyTrackRenderParams>
}

export interface SyntenyPickResult {
  key: number
  instanceIndex: number
}

/**
 * One canvas, a block per cell: the tracks of one level, each with its own
 * uploaded geometry, plus the outline of whichever ribbon is selected.
 *
 * The per-region backend, not a keyed one of its own: a block whose bp span is
 * the identity map is a no-op clip, and what is left is exactly the
 * map-plus-blocks a per-region frame already takes. Painting is unconditional —
 * an empty map (no synteny track on this row pair, or the one it had was hidden)
 * paints the ground alone, which is what erases the departed track.
 */
export type SyntenyRenderingBackend = PerRegionRenderingBackend<
  SyntenyCell,
  SyntenyRenderState
>
