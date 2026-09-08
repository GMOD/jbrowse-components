import { getContrastText } from '@jbrowse/core/ui/palette'
import { cssColorToRgb } from '@jbrowse/core/util/colorBits'
import { getDpr } from '@jbrowse/render-core/canvas2dUtils'
import { defineMark } from '@jbrowse/render-core/marks'
import { slangPass } from '@jbrowse/render-core/slangPass'

import { drawSyntenyTrack } from './drawSyntenyTrack.ts'
import {
  packClickedOutlineInstances,
  syntenyInstanceCache,
} from './instanceInterleave.ts'
import * as syntenyEdgeCurveShader from './shaders/syntenyEdgeCurve.generated.ts'
import * as syntenyEdgeStraightShader from './shaders/syntenyEdgeStraight.generated.ts'
import * as syntenyFillCurveShader from './shaders/syntenyFillCurve.generated.ts'
import * as syntenyFillStraightShader from './shaders/syntenyFillStraight.generated.ts'
import { computeTransform } from './syntenyRibbonPath.ts'

import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type { SyntenyTrackRenderParams } from './syntenyRenderingBackendTypes.ts'
import type { Mark, MarkFrame, MarkShape } from '@jbrowse/render-core/marks'
import type { ClearColor } from '@jbrowse/render-core/perRegionRenderingBackend'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'
import type { ShaderModule } from '@jbrowse/render-core/slangPass'

const PASS_FILL_STRAIGHT = 'fillStraight'
const PASS_FILL_CURVE = 'fillCurve'
const PASS_EDGE_STRAIGHT = 'edgeStraight'
const PASS_EDGE_CURVE = 'edgeCurve'

/**
 * The clicked feature's outline as an upload cell: the region's own packed
 * bytes plus which feature to cut out of them. The pack is a byte copy of the
 * matching records out of the interleave cache the fill already filled, so the
 * cell is three fields and a click costs one small buffer rather than a repack.
 */
export interface SyntenyOutlineChannels {
  data: SyntenyInstanceData
  featureId: number
}

/**
 * One track's draw state where the two backends meet: the per-track params, the
 * fetch-time bases the buffer was packed against (which ride the payload, as
 * dotplot's `baseH`/`baseV` do), and the band's own two values. `groundColor` is
 * a param rather than a frame field because the multi-way stack draws its
 * gutters through these same shapes under a frame of its own.
 */
export interface SyntenyRibbonParams {
  track: SyntenyTrackRenderParams
  base0: number
  base1: number
  overdrawPx: number
  groundColor: string
}

/**
 * The band's ground as a straight RGBA clear.
 *
 * OPAQUE AND KNOWN, NOT TRANSPARENT, and it is load-bearing for what the band
 * looks like rather than for what it costs. Every other backend in the tree
 * clears to (0,0,0,0); this one does not, because the two fill branches only
 * agree over a ground they both know. `resolveInstanceFill` in
 * `drawSyntenyTrack.ts` is the arithmetic: a BASE ribbon comes out `rgb*darken`
 * at alpha `shade`, while a CIGAR indel comes out
 * `rgb*darken*shade + ground*(1 - shade)` FULLY OPAQUE — the indel palette is
 * opaque literals (`colorUtils.ts` warns against a non-opaque one). Those land
 * on the same pixel only when the destination IS `ground`, since
 * base-over-ground is `rgb*shade + ground*(1 - shade)`, the pre-blend byte for
 * byte. Over any other backdrop the indel stays blended toward a colour that is
 * not there while the base beside it composites over the real one, so every
 * indel wedge reads as a hole punched in the band. `shadeFill` in
 * syntenyTypes.slang is the GPU spelling of the same thing, and
 * `blendOverGround` a third for the legend chips.
 *
 * NOT A PERFORMANCE CHOICE, which is worth saying because it looks like one: a
 * clear costs the same whatever the value, and both HALs configure the context
 * with alpha on, so no opaque-layer compositor path is being bought either.
 *
 * SO INK DRAWN ONTO THE BAND IS DERIVED FROM THE SAME VALUE, never read off the
 * theme independently: `getContrastText(groundColor)` is the one source, and
 * `markerColor`, `drawOffscreenMates`' `offscreenMateColors`, its label halo and
 * the clicked outline all come off it. Reading `theme.palette.text.secondary`
 * beside a ground that did not move with it is the bug that shipped the
 * off-screen-mate strip invisible: near-white marks at 0.35 alpha on white.
 *
 * What is STILL a light-ground assumption is the ribbon palettes themselves —
 * `defaultCigarColors` and the categorical ramps are fixed colours picked for a
 * white band, and at the 0.2 default alpha they are near invisible on a dark
 * one. Threading the ground is what makes a dark band expressible; tuning those
 * is the separate follow-up, in the `colorPairLRDark` mould.
 */
export function syntenyGroundClear(groundColor: string): ClearColor {
  const [r, g, b] = cssColorToRgb(groundColor)
  return [r / 255, g / 255, b / 255, 1]
}

/**
 * The synteny passes' uniform block for one track. All four shaders declare one
 * `Uniforms` struct out of syntenyTypes.slang — `syntenyPassGeometry.test.ts`
 * pins it — so one writer serves every shape, and two marks of one block draw
 * off a single staged write.
 */
function writeRibbonUniforms(
  scratch: ArrayBuffer,
  frame: MarkFrame,
  p: SyntenyRibbonParams,
) {
  const { track } = p
  // panPx = (base - offsetPx*bpPerPx)/bpPerPx: how far the current view has
  // panned from the fetch-time base, in px. Computed float64 from a SMALL
  // numerator (base ≈ the fetch-time viewport start), so no genome-scale
  // magnitude is multiplied by the rounded inv — that's what lets a single
  // Float32 corner stay sub-pixel. Shared with the CPU draw + pick paths
  // (computeTransform) so the two cannot drift; the shader consumes exactly
  // these four numbers in computeCorners (syntenyTypes.slang).
  const t = computeTransform(track, p)
  const [gr, gg, gb] = cssColorToRgb(p.groundColor)
  const [ir, ig, ib] = cssColorToRgb(getContrastText(p.groundColor))
  syntenyFillStraightShader.writeUniforms(scratch, {
    resolution: [frame.canvasWidth, frame.canvasHeight],
    // Floored here rather than in each shader — see the Uniforms.height note in
    // syntenyTypes.slang. A zero-height ribbon would divide by it.
    height: Math.max(track.height, 1),
    panPx0: t.panPx0,
    bpPerPxInv0: t.bpPerPxInv0,
    panPx1: t.panPx1,
    bpPerPxInv1: t.bpPerPxInv1,
    overdrawPx: p.overdrawPx,
    minAlignmentLength: track.minAlignmentLength,
    alpha: track.alpha,
    hoveredFeatureId: track.hoveredFeatureId,
    clickedFeatureId: track.clickedFeatureId,
    yTop: track.yTop,
    fadeThinAlignments: track.fadeThinAlignments ? 1 : 0,
    // The shaders measure in CSS px but rasterize on the device-px grid, so
    // they need the ratio to size their AA ramps at one output pixel.
    devicePixelRatio: getDpr(),
    // `ground` must be what the frame cleared to — shadeFill bakes it into
    // every indel wedge — and `ink` is what the edge pass strokes the clicked
    // outline in, contrast-derived so a dark band gets a light outline.
    ground: [gr / 255, gg / 255, gb / 255],
    ink: [ir / 255, ig / 255, ib / 255],
  })
}

/**
 * A track's ribbons in one of the two fill modes. `drawCurves` picks which of
 * the pair paints, so a mode switch is a different pass over the same uploaded
 * buffer rather than a re-upload.
 *
 * **No `hitNearest`, deliberately.** The question a ribbon answers is not
 * "where is the nearest ink" but "is this point inside the silhouette", and the
 * silhouette is a sheared quad or a pair of cubic beziers that `buildFeaturePath`
 * already traces and `isPointInPath` already tests. A `hitNearest` would be a
 * second, analytic spelling of that path — the exact drift `syntenyRibbonPath`
 * exists to prevent — so the pick stays a model-level function over the same
 * geometry the painter uses, as the arc band's does.
 */
function ribbonFillShape(
  id: string,
  mod: ShaderModule,
  curves: boolean,
): MarkShape<SyntenyInstanceData, SyntenyRibbonParams | undefined> {
  return {
    id,
    pass: {
      ...slangPass({ id, mod }),
      pack: data => syntenyInstanceCache.get(data),
    },
    writeUniforms(scratch, _clip, _block, frame, p) {
      if (p) {
        writeRibbonUniforms(scratch, frame, p)
      }
    },
    paintsBlock(_block, _frame, p) {
      return p !== undefined && p.track.drawCurves === curves
    },
    paintBlock(ctx, data, _block, frame, p) {
      if (p) {
        drawSyntenyTrack(
          ctx,
          data,
          p.track,
          frame.canvasWidth,
          p.overdrawPx,
          p.groundColor,
        )
      }
    },
  }
}

/**
 * The clicked ribbon's silhouette, stroked over the fill it traces. The edge
 * pass re-draws the fill pass's own polygon from the same packed record, in the
 * band's contrast ink.
 *
 * **GPU-only, by construction, and that is the one intentional asymmetry in the
 * pair.** `drawSyntenyTrack` strokes the clicked feature's side edges inside
 * its own loop, where it already holds the projected corners and the fill/stroke
 * decision the outline is gated on — so painting here would be the second copy
 * of that, drawn from an outline cell that does not know which of its instances
 * the painter chose to fill. `GPU_RENDERING.md` §"Intentional divergences"
 * carries the rest.
 */
function ribbonEdgeShape(
  id: string,
  mod: ShaderModule,
  curves: boolean,
): MarkShape<SyntenyOutlineChannels, SyntenyRibbonParams | undefined> {
  return {
    id,
    pass: {
      ...slangPass({ id, mod }),
      pack: ({ data, featureId }) =>
        packClickedOutlineInstances(
          data,
          featureId,
          syntenyInstanceCache.get(data),
        ).buf,
    },
    writeUniforms(scratch, _clip, _block, frame, p) {
      if (p) {
        writeRibbonUniforms(scratch, frame, p)
      }
    },
    paintsBlock(_block, _frame, p) {
      return p !== undefined && p.track.drawCurves === curves
    },
    paintBlock() {},
  }
}

const fillStraightShape = ribbonFillShape(
  PASS_FILL_STRAIGHT,
  syntenyFillStraightShader,
  false,
)
const fillCurveShape = ribbonFillShape(
  PASS_FILL_CURVE,
  syntenyFillCurveShader,
  true,
)
const edgeStraightShape = ribbonEdgeShape(
  PASS_EDGE_STRAIGHT,
  syntenyEdgeStraightShader,
  false,
)
const edgeCurveShape = ribbonEdgeShape(
  PASS_EDGE_CURVE,
  syntenyEdgeCurveShader,
  true,
)

/**
 * The ribbon marks for a display whose cells carry ribbon geometry, outline
 * selections, or neither — the pairwise band and the multi-way stack are both
 * that shape, and both draw through these four.
 *
 * `fillStraight` owns the region's buffer and `fillCurve` borrows it
 * (`bufferOf`), which is what makes a `drawCurves` toggle a uniform and a
 * different pass rather than a second upload; the outline pair is the same
 * split over its own small buffer.
 */
export function syntenyRibbonMarks<TRegion, TState extends MarkFrame>(lenses: {
  ribbons: (region: TRegion) => SyntenyInstanceData | undefined
  outline: (region: TRegion) => SyntenyOutlineChannels | undefined
  params: (
    state: TState,
    region: TRegion,
    block: RenderBlock,
  ) => SyntenyRibbonParams | undefined
}): Mark<TRegion, TState>[] {
  const { ribbons, outline, params } = lenses
  const fillStraight = defineMark({
    shape: fillStraightShape,
    channels: ribbons,
    params,
  })
  const edgeStraight = defineMark({
    shape: edgeStraightShape,
    channels: outline,
    params,
  })
  return [
    fillStraight,
    defineMark({
      shape: fillCurveShape,
      channels: ribbons,
      params,
      bufferOf: fillStraight,
    }),
    edgeStraight,
    defineMark({
      shape: edgeCurveShape,
      channels: outline,
      params,
      bufferOf: edgeStraight,
    }),
  ]
}

/**
 * One cell's whole canvas as one block. A ribbon's x is not a block's bp span —
 * a corner's screen x comes from the payload's own window-relative bp through
 * the shader's `panPx` fold and the painter's `computeTransform` — so the block
 * carries nothing but its key and the identity bp span that keeps `clipBlock`
 * well-formed. `dotplotMarkBlock` is the same shape for the same reason.
 */
export function syntenyMarkBlock(
  key: number,
  canvasWidth: number,
): RenderBlock {
  return {
    displayedRegionIndex: key,
    start: 0,
    end: canvasWidth,
    screenStartPx: 0,
    screenEndPx: canvasWidth,
    reversed: false,
  }
}
