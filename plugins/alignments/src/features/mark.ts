// What one pileup mark COVERS, declared once. THE derivation — the GPU packer,
// the Canvas2D painter (and through it the SVG export) and the hit test all take
// their arrays, their selection predicate, their gates and their span from here.
//
// They used to each state them. `features/gap` was the smallest complete
// example: three files walking `(gapPositions, gapYs, gapTypes, gapFrequencies)`
// under three spellings of `gapTypes[i] === kind`, three spellings of
// `gapPositions[i * 2]`, and two independently-written gates — one of which had
// to be ADDED to the hit test after the fact, because without it a deletion the
// worker had zeroed went on intercepting every click across its span while the
// shader faded it to four of 255 alpha. `features/arcs/mark.ts` is the same
// argument for the arc band's two shapes, and records the two drift bugs that
// made it: two instances of one shape is a missing function, not two bugs.
//
// What this deliberately does NOT do, both settled and both easy to get wrong:
//
// - It is not a transpiled draw stage. adr-051 stands — the `.slang` stays
//   hand-written, and the scalar decisions the two backends share come across
//   through `//! js-export`, not through this. A mark reads those twins
//   (`intronAlpha`, `sizeAlpha`, `frequencyFadeGate`); it does not replace them.
// - It does not erase the intentional backend divergences. The Canvas2D-only AA
//   compensation lives on `MarkCanvas2D` where a reader can see it is per
//   backend, rather than hidden in the shared walk or ported into a shader.
import { fillSpanRect } from '@jbrowse/alignments-core'

import {
  bpToScreenX,
  pileupRowOffCanvas,
  pileupRowY,
} from '../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import { findTopmostOnRow } from '../shared/hitTestTypes.ts'

import type {
  DrawBlock,
  RenderState,
} from '../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { CigarCoords } from '../shared/hitTestTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

// The block a mark is projected through, as the Canvas2D painters already
// receive it. `bpLength`/`fullBlockWidth` are the block's clip-derived span, so
// the projection here is the same one every other pileup layer runs.
export interface MarkFrame {
  block: DrawBlock
  bpLength: number
  fullBlockWidth: number
}

// The Canvas2D half of a mark: which band inside its row the mark paints, and
// the anti-aliasing compensation that band needs. Per-instance rather than per
// mark because a feature's own kinds can differ here — a gap is a full-height
// bar as a deletion and a 1px centerline as an intron, which is what
// gap.slang's own branch does.
//
// Nothing on this has a GPU counterpart, and that is the point of it being one
// named group: an AA fudge factor belongs to a SHAPE on one backend, and
// ARCHITECTURE.md instructs not to port one into a `.slang`.
export interface MarkCanvas2D<Data> {
  bandTop: (
    data: Data,
    index: number,
    rowY: number,
    featureHeight: number,
  ) => number
  bandHeight: (data: Data, index: number, featureHeight: number) => number
}

// One feature's mark, as its three consumers need it. Every member takes
// `(data, index)` rather than an instance object: these loops run per mark per
// frame and per covered bp, and `fillSpanRect`'s own note sets the bar — sharing
// anything out of them has to allocate nothing.
export interface PileupMark<Data> {
  // The pileup row of every instance, one entry per instance. Both the array
  // `findTopmostOnRow` scans and the length every consumer's loop is bounded by,
  // so the count is not a second expression free to disagree.
  rows: (data: Data) => ArrayLike<number>
  // The mark's absolute genomic extent, half-open. THE span: the packer uploads
  // it, the painter projects it and the hit test contains a cursor in it.
  startBp: (data: Data, index: number) => number
  endBp: (data: Data, index: number) => number
  // Which entries of a shared array this mark owns. A feature whose kinds are
  // separate draw layers builds one mark per layer, and between them they still
  // cover each entry exactly once.
  selects: (data: Data, index: number) => boolean
  // Drawn opacity, 0 for a mark that paints nothing. `widthPx` is the mark's
  // true on-screen span, which is what the shader's fades test.
  alpha: (
    data: Data,
    index: number,
    state: RenderState,
    widthPx: number,
  ) => number
  // Whether the mark may intercept a click, which is NOT `alpha > 0` and must
  // not be keyed off it. Visibility is gradual and significance is a threshold:
  // a mark below the worker's frequency threshold still paints at the fade's
  // floor while being deliberately inert, so that it cannot steal clicks from
  // the read body under it. See `passesFrequencyGate`.
  hittable: (
    data: Data,
    index: number,
    coords: CigarCoords,
    filterByFrequency: boolean,
  ) => boolean
  canvas2d: MarkCanvas2D<Data>
}

// How many instances a mark owns — what a packer allocates for. Counted rather
// than over-allocated: `uploadPass` reads the instance count off the buffer's
// own byteLength, so trailing capacity would draw.
export function countMarks<Data>(mark: PileupMark<Data>, data: Data) {
  const n = mark.rows(data).length
  let count = 0
  for (let i = 0; i < n; i++) {
    if (mark.selects(data, i)) {
      count++
    }
  }
  return count
}

/**
 * Paint every instance of `mark` into `ctx`.
 *
 * The projection, the reversed-block edge ordering, the row band and the
 * sub-pixel widening are stated here once for every feature that draws a span:
 * `fillSpanRect` widens a sub-pixel mark to 1px CENTERED on its span, which is
 * what `expandMinWidthX` does on the GPU, and getting that pivot half-right at
 * one call site out of five is a bug this repo has shipped twice.
 *
 * `style` receives the resolved alpha, because the opaque case — every mark once
 * zoomed in — wants a CSS string the caller hoisted out of the loop rather than
 * one formatted per instance.
 */
export function paintMarks<Data>(
  ctx: Ctx2D,
  mark: PileupMark<Data>,
  data: Data,
  frame: MarkFrame,
  state: RenderState,
  style: (alpha: number, data: Data, index: number) => string,
) {
  const { block, bpLength, fullBlockWidth } = frame
  const { bandTop, bandHeight } = mark.canvas2d
  const rows = mark.rows(data)
  const fH = state.featureHeight
  for (let i = 0; i < rows.length; i++) {
    if (mark.selects(data, i)) {
      const rowY = pileupRowY(rows[i]!, state)
      if (!pileupRowOffCanvas(rowY, state)) {
        const x1 = bpToScreenX(
          mark.startBp(data, i),
          block,
          bpLength,
          fullBlockWidth,
        )
        const x2 = bpToScreenX(
          mark.endBp(data, i),
          block,
          bpLength,
          fullBlockWidth,
        )
        // A reversed (flipped) region maps startBp to the larger screen x, so
        // the edges are ordered here and the span is the absolute width.
        const px = Math.min(x1, x2)
        const px2 = Math.max(x1, x2)
        const alpha = mark.alpha(data, i, state, px2 - px)
        if (alpha > 0) {
          ctx.fillStyle = style(alpha, data, i)
          fillSpanRect(
            ctx,
            px,
            px2,
            bandTop(data, i, rowY, fH),
            bandHeight(data, i, fH),
          )
        }
      }
    }
  }
}

/**
 * The instance of `mark` under the cursor, or undefined for none.
 *
 * Topmost, not first: see `findTopmostOnRow`. On a collapsed group every read
 * sits on row 0, so scanning forwards answers with the mark of a read painted
 * under the one `hitTestFeature` names alongside it.
 *
 * The containment test is the same half-open span the painter projects, so the
 * two cannot disagree about which bases a mark occupies — the drift that has no
 * cross-backend gate, because every gate this repo has is GPU vs Canvas2D.
 */
export function findMarkAt<Data>(
  mark: PileupMark<Data>,
  data: Data,
  coords: CigarCoords,
  filterByFrequency: boolean,
) {
  const rows = mark.rows(data)
  const { genomicPos } = coords
  return findTopmostOnRow(
    rows,
    0,
    rows.length,
    coords.row,
    i =>
      mark.selects(data, i) &&
      mark.hittable(data, i, coords, filterByFrequency) &&
      genomicPos >= mark.startBp(data, i) &&
      genomicPos < mark.endBp(data, i),
  )
}
