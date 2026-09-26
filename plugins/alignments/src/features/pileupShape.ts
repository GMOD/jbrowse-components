// The pileup's mark shapes: one factory over render-core's `MarkShape`, taking
// a shader, its packer and the rule codes one row-instanced pass draws and
// hit-tests by. A new rule is a code and a case here, never a function on the
// mark; plugins/alignments/src/CLAUDE.md says what the codes were measured at.
import {
  insertionSizeAlpha,
  spanRectLeftPx,
  spanRectWidthPx,
} from '@jbrowse/alignments-core'
import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'
import {
  bpAtPx,
  bpAtPxExact,
  bpProjection,
  makeBpMapper,
  projectBp,
  pxPerBpOf,
} from '@jbrowse/render-core/canvas2dUtils'
import { inkOnRect } from '@jbrowse/render-core/marks/hit'
import { slangPass } from '@jbrowse/render-core/slangPass'

import {
  LONG_INSERTION_MIN_LENGTH,
  getInsertionType,
  insertionBarWidth,
  passesFrequencyGate,
} from '../LinearAlignmentsDisplay/constants.ts'
import { writePileupUniforms } from '../LinearAlignmentsDisplay/renderers/pileupUniforms.ts'
import {
  frequencyFade,
  intronAlpha,
  pileupCellWidth,
  pileupRowOffCanvas,
  pileupRowY,
  sizeAlpha,
} from '../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import { qualityFade } from '../shaders/slang/mismatch.js.generated.ts'
import {
  overlapAlpha,
  overlapFade,
} from '../shaders/slang/overlap.js.generated.ts'

import type { RenderState } from '../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { BpProjection } from '@jbrowse/render-core/canvas2dUtils'
import type {
  InkRect,
  MarkContext2D,
  MarkHit,
  MarkShape,
} from '@jbrowse/render-core/marks'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'
import type { ShaderModule } from '@jbrowse/render-core/slangPass'

/**
 * The arrays one pileup mark walks, resolved once per region by the mark's
 * `channels` lens. Every mark writes every field in this order — `undefined`
 * for an array its rules never read — so the walkers read one hidden class
 * across all the marks.
 *
 * `positions` holds absolute bp: `[start, end]` pairs at `stride` 2, one start
 * per instance at `stride` 1. Absolute and unclamped — both rasterizers clip
 * off-screen geometry, and clamping corrupted the hit-test position of a gap
 * beginning left of the view.
 *
 * `start`/`end` bound the mark's own slice. The interbase features share ONE
 * merged array the worker lays out as (insertions, softclips, hardclips), so
 * each of their marks is a slice of it — and softclip beating hardclip at one
 * position is that layout talking, not scan order.
 *
 * `keys` is the per-instance value the colour comes from — a base byte, a
 * quality score, a packed ABGR — read by the packer and the painter alike, and
 * undefined for a mark that draws one colour.
 */
export interface PileupChannels {
  positions: ArrayLike<number>
  stride: number
  rows: ArrayLike<number>
  start: number
  end: number
  // Which entries of a shared array this mark owns: `kinds[i] === kind`, or all
  // of them when `kinds` is undefined. A feature whose kinds are separate draw
  // layers builds one mark per layer, and between them they still cover each
  // entry at most once — a byte that is neither kind belongs to no mark.
  kinds: ArrayLike<number> | undefined
  kind: number
  freqs: ArrayLike<number> | undefined
  quals: ArrayLike<number> | undefined
  lengths: ArrayLike<number> | undefined
  keys: ArrayLike<number> | undefined
}

/**
 * A mark's channels, with every lane it leaves out at its default: one array
 * entry per instance, the whole array, no kind split and no optional lane. The
 * one constructor, so every mark's channels come out in one field order.
 */
export function pileupChannels({
  positions,
  stride = 1,
  rows,
  start = 0,
  end = rows.length,
  kinds,
  kind = 0,
  freqs,
  quals,
  lengths,
  keys,
}: Pick<PileupChannels, 'positions' | 'rows'> &
  Partial<PileupChannels>): PileupChannels {
  return {
    positions,
    stride,
    rows,
    start,
    end,
    kinds,
    kind,
    freqs,
    quals,
    lengths,
    keys,
  }
}

/**
 * Which pivot a shape uses, and it decides TWO things that have to agree: how
 * Canvas2D widens a sub-pixel mark, and which cursor coordinate contains it.
 *
 * - `span` widens about the mark's midpoint (`fillSpanRect`, the twin of the
 *   shader's `expandMinWidthX`) and contains the FRACTIONAL `genomicPos`.
 * - `cell` floors one-sidedly from the base's low-coordinate edge
 *   (`cellPlacement`, matching `pileupCellX`) and contains the INTEGER
 *   `basePos`.
 * - `point` has NO genomic extent — it sits on the edge BETWEEN two reference
 *   bases — so it centres a declared pixel width on the fractional `genomicPos`
 *   and contains a cursor within a declared bp tolerance of it.
 *
 * Pairing the first two wrong is a reversed-block bug, not a rounding one: on a
 * reversed block bp runs leftward, so `genomicPos` inside base b's leftmost
 * pixel column is b+1 exactly. `bpAtPx` owns that pivot and `bpAtPxExact` does
 * not.
 */
export type PileupPivot = 'span' | 'cell' | 'point'

// Drawn opacity, as the rule rather than a closure. `widthPx` is what the mark
// occupies on screen — its true genomic span for `span`/`cell`, its drawn bar
// for a `point` — and `pxPerBp` the zoom, because a point's fades measure the
// zoom itself.
export const Fade = {
  opaque: 0,
  // A deletion HAS a reference span, so its own on-screen width is the measure —
  // the quantity the frequency fade squares. `sizeAlpha` is needed on top: the
  // frequency lerp returns 1 for a site every read carries however sub-pixel it
  // is, so without it a chain's every D op painted a 1px bar across a megabase.
  spanFrequencySize: 1,
  // Phred 50+ opaque, lower fades out, QUAL_UNAVAILABLE stays opaque.
  cellFrequencyQuality: 2,
  // Once reads get compact the per-row centerlines pack into a solid smear, so
  // they fade with the row height.
  intron: 3,
  overlap: 4,
  // A long insertion draws as a fixed marker and never frequency-fades. It does
  // still fade by size — "is this resolvable at this zoom" rather than "is this
  // site rare" — and the two multiply.
  insertion: 5,
  pointFrequency: 6,
} as const
export type FadeRule = (typeof Fade)[keyof typeof Fade]

// Whether a mark may intercept a click, which is NOT `alpha > 0` and must not be
// keyed off it. Visibility is gradual and significance is a threshold: a mark
// below the worker's frequency threshold still paints at the fade's floor while
// being deliberately inert, so it cannot steal clicks from the read body under
// it. See `passesFrequencyGate`.
export const Hit = {
  always: 0,
  frequency: 1,
  // `bpPerPx / length` rather than a bare `bpPerPx`, because the "already covers
  // a pixel" half of the gate is per-mark and a deletion's span is not one base.
  spanFrequency: 2,
  // A faded-out insertion is inert; a small one is frequency-gated like a
  // mismatch, a large one never. Which SIZE answers at which priority is the
  // hit chain's, stated as its candidate set (`insertionsOfSize`).
  insertion: 3,
} as const
export type HitRule = (typeof Hit)[keyof typeof Hit]

// Which band inside its row a mark paints. Per mark, not per instance: gap's two
// kinds are already two marks, so a deletion mark never meets an intron.
export const Band = { row: 0, centerline: 1 } as const
export type BandRule = (typeof Band)[keyof typeof Band]

// The two rules the two `point` shapes draw and hit by. Two members rather than
// one derivation, and that is a measurement: an insertion's tolerance IS its
// drawn bar plus two pixels either side, while a clip's is a floor in bp, which
// no width rule expresses.
export const Point = { insertionBar: 0, clipBar: 1 } as const
export type PointRule = (typeof Point)[keyof typeof Point]

// Pixels of slop either side of a drawn insertion bar. What makes a 1px
// insertion clickable at all.
const INSERTION_HIT_SLOP_PX = 2
// A clip bar is a fixed 1px whatever the zoom: the mark it makes is that an
// alignment ends here, which has no width to be proportional to. Its hit rule is
// NOT a width derivation — 1px plus the usual slop would be 2.5px, and the bp
// floor is what keeps a clip clickable at base-level zoom, where 3px is a third
// of a base.
const CLIP_BAR_WIDTH_PX = 1
const CLIP_HIT_TOLERANCE_PX = 3
const CLIP_HIT_MIN_TOLERANCE_BP = 0.5

// Where a mark's colour comes from. `palette` indexes the two tables by the
// instance's key; `packedAbgr` formats the worker's own u32 per RUN, since that
// palette is a per-read choice rather than a small table.
export const Paint = { palette: 0, packedAbgr: 1 } as const
export type PaintRule = (typeof Paint)[keyof typeof Paint]

/**
 * The colours ONE draw call paints with, resolved per block from the state.
 * Colour is data for the same reason the fades are: a closure here is a call
 * per instance in the hot loop, and it measured as most of the paint — 54 ms of
 * a mismatch layer's 66, on 100K instances.
 *
 * Two tables because the opaque case is the common one once zoomed in and wants
 * a whole string built once, where a genuinely faded mark is `rgbaPrefix255`'s
 * head rejoined with its own alpha — one number converted per instance instead
 * of four. `channels.keys` indexes both; under `Paint.packedAbgr` it IS the
 * colour.
 */
export interface PaintTables {
  rule: PaintRule
  opaqueCss: readonly string[]
  fadedCss: readonly string[]
}

export interface PileupShapeSpec {
  id: string
  mod: ShaderModule
  pack: (channels: PileupChannels) => ArrayBuffer
  pivot: PileupPivot
  fade: FadeRule
  hit: HitRule
  band: BandRule
  // Half a pixel of overdraw for the layers that paint an unbroken wall of
  // abutting cells: Canvas2D anti-aliases each cell's fractional edges and two
  // abutting AA'd edges do not sum to full opacity, leaving a hairline seam. The
  // GPU tiles pixel-snapped quads seamlessly and needs none of it, which is why
  // it is stated here and not in a `.slang`. Sparse marks never abut.
  contiguous: boolean
  point?: PointRule
  paint: (state: RenderState) => PaintTables
  // The point glyph's second half: anything a feature draws ON the centred bar
  // is its own, and insertion's serif caps are the only such thing in tree.
  // `widthPx` is how far it reaches about the centre, so the ink covers it.
  decorate?: {
    draw: (
      ctx: MarkContext2D,
      xCenter: number,
      top: number,
      height: number,
      channels: PileupChannels,
      index: number,
      pxPerBp: number,
    ) => void
    widthPx: (
      channels: PileupChannels,
      index: number,
      pxPerBp: number,
    ) => number
  }
}

// Whether entry `index` belongs to this mark. One spelling for the walkers and
// every packer, so a feature whose kinds are separate layers cannot have one
// consumer disagree about which entries it owns.
export function markSelects(
  kinds: ArrayLike<number> | undefined,
  kind: number,
  index: number,
) {
  return kinds === undefined || kinds[index] === kind
}

// How many instances a mark owns — what a packer allocates for. Counted rather
// than over-allocated: `uploadPass` reads the instance count off the buffer's
// own byteLength, so trailing capacity would draw.
export function countMarks(c: PileupChannels) {
  const { kinds, kind, start, end } = c
  if (kinds === undefined) {
    return end - start
  }
  let count = 0
  for (let i = start; i < end; i++) {
    if (markSelects(kinds, kind, i)) {
      count++
    }
  }
  return count
}

function hitPasses(
  hit: HitRule,
  c: PileupChannels,
  index: number,
  bpPerPx: number,
  filterByFrequency: boolean,
): boolean {
  switch (hit) {
    case Hit.always: {
      return true
    }
    case Hit.frequency: {
      return passesFrequencyGate(bpPerPx, c.freqs![index]!, filterByFrequency)
    }
    case Hit.spanFrequency: {
      const offset = index * c.stride
      const length = c.positions[offset + 1]! - c.positions[offset]!
      return passesFrequencyGate(
        length > 0 ? bpPerPx / length : bpPerPx,
        c.freqs![index]!,
        filterByFrequency,
      )
    }
    case Hit.insertion: {
      const length = c.lengths![index]!
      const pxPerBp = 1 / bpPerPx
      // An insertion the renderer has faded out for being unresolvable at this
      // zoom must not intercept clicks either, or a whole-genome view is
      // carpeted in invisible hit targets.
      if (insertionSizeAlpha(length, pxPerBp) === 0) {
        return false
      }
      // Away from base-level zoom only a high-frequency small insertion may
      // intercept a click, so the read body stays easy to click through. A large
      // insertion is never frequency-gated, matching its fade.
      return (
        getInsertionType(length, pxPerBp) !== 'small' ||
        passesFrequencyGate(bpPerPx, c.freqs![index]!, filterByFrequency)
      )
    }
  }
}

// THE width: the painter fills it and the tolerance below measures from it, so
// the box a person sees and the box they can click are one expression apart. The
// GPU sizes its own quad from the shader's twin of the same rule.
function pointWidthPx(
  point: PointRule,
  c: PileupChannels,
  index: number,
  pxPerBp: number,
  featureHeight: number,
) {
  return point === Point.insertionBar
    ? insertionBarWidth(c.lengths![index]!, pxPerBp, featureHeight)
    : CLIP_BAR_WIDTH_PX
}

interface PileupFrame extends BpProjection {
  state: RenderState
  pxPerBp: number
  bpPerPx: number
  fade: FadeRule
  point: PointRule | undefined
  cell: { w: number; cellX: (bp: number) => number } | undefined
  decorate: PileupShapeSpec['decorate']
  bandOffset: number
  bandHeight: number
  constantAlpha: number
  tables: PaintTables
}

const UNPAINTED: PaintTables = {
  rule: Paint.palette,
  opaqueCss: [],
  fadedCss: [],
}

const PLACED = new Float64Array(5)

/**
 * Instances `from..to` in paint order, and the one statement of where each one
 * goes and how faded it is. With a `ctx` it paints every instance that has ink;
 * without one it stops at the first and writes `[left, top, width, height]` to
 * `out`, with a point's centre at `out[4]`. An instance has no ink when it is a
 * byte of a shared array the mark does not own, a row off the canvas, or a fade
 * at zero.
 *
 * A loop rather than a placement call per instance, and one `frequencyFade`
 * call site rather than one per rule, because both have to fit TurboFan's
 * inlining budget: the per-instance call measured 1.20-1.32x of this walk
 * (`plugins/alignments/benches/rectWalker.bench.ts`).
 */
function walk(
  ctx: MarkContext2D | undefined,
  c: PileupChannels,
  f: PileupFrame,
  from: number,
  to: number,
  out: Float64Array,
) {
  const { positions, stride, rows, kinds, kind, freqs, quals, lengths } = c
  const { keys } = c
  const { state, pxPerBp } = f
  const { fade, point, cell, decorate, bandOffset, bandHeight } = f
  const { constantAlpha } = f
  const { rule, opaqueCss, fadedCss } = f.tables
  const { featureHeight, mismatchAlpha, chainMode } = state
  const constantCss =
    ctx !== undefined &&
    keys === undefined &&
    (fade === Fade.opaque || fade === Fade.intron)
      ? constantAlpha >= 1
        ? opaqueCss[0]!
        : `${fadedCss[0]!}${constantAlpha})`
      : undefined
  if (ctx !== undefined && constantCss !== undefined) {
    ctx.fillStyle = constantCss
  }
  let lastKey = -1
  let lastCss = ''
  for (let i = from; i < to; i++) {
    if (!markSelects(kinds, kind, i)) {
      continue
    }
    const rowY = pileupRowY(rows[i]!, state)
    if (pileupRowOffCanvas(rowY, state)) {
      continue
    }
    const offset = i * stride
    const startBp = positions[offset]!
    const widthPx =
      point === undefined
        ? ((stride === 2 ? positions[offset + 1]! : startBp + 1) - startBp) *
          pxPerBp
        : pointWidthPx(point, c, i, pxPerBp, featureHeight)
    let alpha = constantAlpha
    let frequencyFades = false
    let frequencyBase = 0
    switch (fade) {
      case Fade.spanFrequencySize: {
        frequencyFades = true
        frequencyBase = widthPx * widthPx
        alpha = sizeAlpha(widthPx)
        break
      }
      case Fade.cellFrequencyQuality: {
        frequencyFades = true
        frequencyBase = widthPx
        alpha = qualityFade(quals![i]!, mismatchAlpha)
        break
      }
      case Fade.overlap: {
        alpha = chainMode ? overlapFade(widthPx) : overlapAlpha(widthPx)
        break
      }
      case Fade.insertion: {
        const length = lengths![i]!
        frequencyFades = length < LONG_INSERTION_MIN_LENGTH
        frequencyBase = pxPerBp * pxPerBp
        alpha = insertionSizeAlpha(length, pxPerBp)
        break
      }
      case Fade.pointFrequency: {
        frequencyFades = true
        frequencyBase = pxPerBp
        alpha = 1
        break
      }
      case Fade.opaque:
      case Fade.intron: {
        break
      }
    }
    if (frequencyFades) {
      alpha *= frequencyFade(state, frequencyBase, freqs![i]!)
    }
    if (!(alpha > 0)) {
      continue
    }
    const top = rowY + bandOffset
    let left: number
    let width: number
    let x = 0
    if (cell !== undefined) {
      left = cell.cellX(startBp)
      width = cell.w
    } else {
      x = projectBp(f, startBp)
      if (point !== undefined) {
        left = x - widthPx / 2
        width = widthPx
      } else {
        const x2 = projectBp(f, positions[offset + 1]!)
        const lo = x < x2 ? x : x2
        const hi = x < x2 ? x2 : x
        left = spanRectLeftPx(lo, hi)
        width = spanRectWidthPx(lo, hi, left)
      }
    }
    if (ctx === undefined) {
      out[0] = left
      out[1] = top
      out[2] = width
      out[3] = bandHeight
      out[4] = x
      return true
    }
    if (constantCss === undefined) {
      const key = keys === undefined ? 0 : keys[i]!
      if (rule === Paint.packedAbgr) {
        if (key !== lastKey) {
          lastKey = key
          lastCss = abgrToCssRgba(key)
        }
        ctx.fillStyle = lastCss
      } else {
        ctx.fillStyle =
          alpha >= 1 ? opaqueCss[key]! : `${fadedCss[key]!}${alpha})`
      }
    }
    ctx.fillRect(left, top, width, bandHeight)
    decorate?.draw(ctx, x, top, bandHeight, c, i, pxPerBp)
  }
  return false
}

function place(
  c: PileupChannels,
  f: PileupFrame,
  i: number,
  out: Float64Array,
) {
  return walk(undefined, c, f, i, i + 1, out)
}

// Wider than the ink on purpose — a 1px bar is not a clickable target — which is
// why the drawn rect is the floor of the draw-against-hit gate, not its bound.
function pointToleranceBp(
  point: PointRule,
  c: PileupChannels,
  index: number,
  bpPerPx: number,
  featureHeight: number,
) {
  return point === Point.insertionBar
    ? (pointWidthPx(point, c, index, 1 / bpPerPx, featureHeight) / 2 +
        INSERTION_HIT_SLOP_PX) *
        bpPerPx
    : Math.max(CLIP_HIT_MIN_TOLERANCE_BP, bpPerPx * CLIP_HIT_TOLERANCE_PX)
}

// A cell stands on its base's low-coordinate edge and grows toward the next
// base, leftward on a reversed block: `pileupCellX`, mirrored by `flipX`.
function cellPlacement(block: RenderBlock, w: number) {
  const toX = makeBpMapper(block)
  return { w, cellX: block.reversed ? (bp: number) => toX(bp) - w : toX }
}

/**
 * One row-instanced pileup shape over render-core's `MarkShape`. `walk` states
 * the projection, the reversed-block edge ordering, the row band, the sub-pixel
 * widening and the fade once for every pass that draws on a pileup row: the
 * painter walks the block with it, and `ink` and `hitNearest` place one
 * instance through it. The codes say which rules apply.
 *
 * `writeUniforms` is the whole pileup struct — palette and frame — which is
 * what a `drawMarks` caller would need. The renderer never asks for it: it
 * writes the palette once a frame and the frame slots once a section, and draws
 * the plan off that (`GpuAlignmentsRenderer`).
 */
export function pileupShape(
  spec: PileupShapeSpec,
): MarkShape<PileupChannels, RenderState> {
  const { id, mod, pack, pivot, fade, hit, band, contiguous, point, decorate } =
    spec
  const centerline = band === Band.centerline
  const frameOf = (
    block: RenderBlock,
    state: RenderState,
    tables = UNPAINTED,
  ): PileupFrame => {
    const { featureHeight } = state
    const bpPerPx =
      (block.end - block.start) / (block.screenEndPx - block.screenStartPx)
    return {
      ...bpProjection(block),
      state,
      pxPerBp: pxPerBpOf(block),
      bpPerPx,
      fade,
      point,
      cell:
        pivot === 'cell'
          ? cellPlacement(block, pileupCellWidth(bpPerPx, contiguous))
          : undefined,
      decorate,
      bandOffset: centerline ? featureHeight / 2 - 0.5 : 0,
      bandHeight: centerline ? 1 : featureHeight,
      constantAlpha: fade === Fade.intron ? intronAlpha(featureHeight) : 1,
      tables,
    }
  }
  const inkOf = (
    c: PileupChannels,
    f: PileupFrame,
    i: number,
  ): InkRect | undefined => {
    if (!place(c, f, i, PLACED)) {
      return undefined
    }
    const top = PLACED[1]!
    const height = PLACED[3]!
    if (decorate === undefined) {
      return { left: PLACED[0]!, top, width: PLACED[2]!, height }
    }
    const width = Math.max(PLACED[2]!, decorate.widthPx(c, i, f.pxPerBp))
    return { left: PLACED[4]! - width / 2, top, width, height }
  }
  return {
    id,
    pass: { ...slangPass({ id, mod }), pack },
    writeUniforms: writePileupUniforms,
    ink(c, block, _frame, state, i) {
      return i < c.start || i >= c.end
        ? undefined
        : inkOf(c, frameOf(block, state), i)
    },

    paintBlock(ctx, c, block, _frame, state) {
      walk(
        ctx,
        c,
        frameOf(block, state, spec.paint(state)),
        c.start,
        c.end,
        PLACED,
      )
    },

    /**
     * Containment, not proximity: an instance answers when the cursor is on
     * its row and inside the bp it covers, or for a point within the tolerance
     * it declares, so a caller passes `Infinity` and the shape's rule is the
     * bound.
     *
     * The distance is to the ink `walk` places: an intron centerline is
     * hittable across its whole row, since a 1px target is not one, and reports
     * how far the line is. A span or cell settles on the first containing
     * candidate, so a back-to-front caller gets the topmost, the one
     * `hitTestFeature` names alongside it; a point keeps the nearest bar.
     */
    hitNearest(c, block, _frame, state, xPx, yPx, candidates, maxDistSq) {
      const { positions, stride, rows, kinds, kind, start, end } = c
      const featureHeight = state.featureHeight
      // The row under the cursor, and only its BODY: above the pileup top the
      // floor divide goes negative, and the inter-row gap resolves to the row
      // above, which is not what a hover there means.
      const rowPitch = featureHeight + state.featureSpacing
      const adjustedY = yPx + state.scrollTop - state.pileupTopOffset
      const row = Math.floor(adjustedY / rowPitch)
      if (adjustedY < 0 || adjustedY - row * rowPitch > featureHeight) {
        return undefined
      }
      const f = frameOf(block, state)
      const { bpPerPx } = f
      const genomicPos = bpAtPxExact(xPx, block)
      const basePos = bpAtPx(xPx, block)
      const filterByFrequency = state.filterMismatchesByFrequency
      const cellBased = pivot === 'cell'
      let best: MarkHit | undefined
      let bestDistSq = maxDistSq
      for (const i of candidates) {
        if (
          i < start ||
          i >= end ||
          rows[i] !== row ||
          !markSelects(kinds, kind, i)
        ) {
          continue
        }
        const offset = i * stride
        const startBp = positions[offset]!
        const contains =
          point !== undefined
            ? Math.abs(genomicPos - startBp) <
              pointToleranceBp(point, c, i, bpPerPx, featureHeight)
            : cellBased
              ? basePos === startBp
              : genomicPos >= startBp && genomicPos < positions[offset + 1]!
        if (!contains || !hitPasses(hit, c, i, bpPerPx, filterByFrequency)) {
          continue
        }
        const r = inkOf(c, f, i)
        if (!r) {
          continue
        }
        const ink = inkOnRect(xPx, yPx, r.left, r.top, r.width, r.height)
        if (ink.distSq < bestDistSq) {
          bestDistSq = ink.distSq
          best = { index: i, x: ink.x, y: ink.y, distSq: ink.distSq }
          if (point === undefined) {
            break
          }
        }
      }
      return best
    },
  }
}
