// What one pileup mark COVERS, declared once as DATA — arrays, selection, the
// two gates and the span. The GPU packer, the Canvas2D painter (and through it
// the SVG export) and the hit test all derive from that declaration.
//
// They used to each state it. `features/gap` was the smallest complete example:
// three files walking `(gapPositions, gapYs, gapTypes, gapFrequencies)` under
// three spellings of `gapTypes[i] === kind` and two independently-written gates
// — one of which had to be ADDED to the hit test after the fact, because without
// it a deletion the worker had zeroed went on intercepting every click across
// its span while the shader faded it to four of 255 alpha.
//
// Channels and rule codes rather than callbacks, because the members used to BE
// callbacks and one shared walker over ten marks made every one of them
// megamorphic: a gap layer's paint fell from 94 ms to 45 at 100K instances, a
// mismatch layer's from 59 to 19, for no change in what either draws.
//
// It is still not a transpiled draw stage. adr-051 stands — the `.slang` stays
// hand-written, and the scalar decisions the two backends share come across
// through `//! js-export`. The rules here READ those twins (`intronAlpha`,
// `sizeAlpha`, `frequencyFadeGate`, `qualityFade`, `overlapFade`).
import { fillSpanRect, insertionSizeAlpha } from '@jbrowse/alignments-core'
import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'

import {
  LONG_INSERTION_MIN_LENGTH,
  getInsertionType,
  insertionBarWidth,
  passesFrequencyGate,
} from '../LinearAlignmentsDisplay/constants.ts'
import {
  bpToScreenX,
  frequencyFade,
  intronAlpha,
  makePileupCellMapper,
  pileupRowOffCanvas,
  pileupRowY,
  sizeAlpha,
} from '../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import { qualityFade } from '../shaders/slang/mismatch.js.generated.ts'
import {
  overlapAlpha,
  overlapFade,
} from '../shaders/slang/overlap.js.generated.ts'

import type {
  DrawBlock,
  RenderState,
} from '../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { CigarCoords } from '../shared/hitTestTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

// The block a mark is projected through, as the Canvas2D painters already
// receive it. `bpLength`/`fullBlockWidth` are the block's clip-derived span.
export interface MarkFrame {
  block: DrawBlock
  bpLength: number
  fullBlockWidth: number
}

/**
 * The arrays one mark walks, resolved once per region. Every mark's `channels`
 * writes every field in this order — `undefined` for an array the mark's rules
 * never read — so the two walkers read one hidden class across all ten marks.
 *
 * `positions` holds absolute bp: `[start, end]` pairs at `stride` 2, one start
 * per instance at `stride` 1. Absolute and unclamped — both rasterizers clip
 * off-screen geometry, and clamping corrupted the hit-test position of a gap
 * beginning left of the view.
 *
 * `start`/`end` bound the mark's own slice. The interbase features share ONE
 * merged array the worker lays out as (insertions, softclips, hardclips), so
 * each of their three marks is a slice of it — and softclip beating hardclip at
 * one position is that layout talking, not scan order.
 */
export interface MarkChannels {
  positions: ArrayLike<number>
  stride: number
  // One row per instance: the array the row scan matches on and the bound every
  // walk runs to, so the count is not a second expression free to disagree.
  rows: ArrayLike<number>
  start: number
  end: number
  // Which entries of a shared array this mark owns: `kinds[i] === kind`, or all
  // of them when `kinds` is undefined. A feature whose kinds are separate draw
  // layers builds one mark per layer, and between them they still cover each
  // entry at most once — a byte that is neither kind belongs to no mark, which
  // is what makes "a kind added to that array has to pick a pass" true.
  kinds: ArrayLike<number> | undefined
  kind: number
  freqs: ArrayLike<number> | undefined
  quals: ArrayLike<number> | undefined
  lengths: ArrayLike<number> | undefined
}

/**
 * Which pivot a mark's shape uses, and it decides TWO things that have to agree:
 * how Canvas2D widens a sub-pixel mark, and which cursor coordinate contains it.
 *
 * - `span` widens about the mark's midpoint (`fillSpanRect`, the twin of the
 *   shader's `expandMinWidthX`) and contains the FRACTIONAL `genomicPos`.
 * - `cell` floors one-sidedly into the base's own cell (`makePileupCellMapper`,
 *   matching mismatch.slang's snapped left edge) and contains the INTEGER
 *   `basePos`.
 * - `point` has NO genomic extent — it sits on the edge BETWEEN two reference
 *   bases — so it centres a declared pixel width on the fractional `genomicPos`
 *   and contains a cursor within a declared bp tolerance of it.
 *
 * Pairing the first two wrong is a reversed-block bug, not a rounding one: on a
 * reversed block bp runs leftward, so `genomicPos` inside base b's leftmost
 * pixel column is b+1 exactly. `bpAtPx` owns that pivot and `bpAtPxExact` does
 * not, and the two coordinates are on `CigarCoords` side by side for this
 * reason.
 */
export type MarkShape = 'span' | 'cell' | 'point'

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
  insertion: 3,
} as const
export type HitRule = (typeof Hit)[keyof typeof Hit]

// Which band inside its row a mark paints. Per mark, not per instance: gap's two
// kinds are already two marks, so a deletion mark never meets an intron.
export const Band = { row: 0, centerline: 1 } as const
export type BandRule = (typeof Band)[keyof typeof Band]

// The two rules the two `point` marks draw and hit by. They are two members
// rather than one derivation, and that is a measurement: an insertion's
// tolerance IS its drawn bar plus two pixels either side, while a clip's is a
// floor in bp, which no width rule expresses.
export const Point = { insertionBar: 0, clipBar: 1 } as const

// Which of the hit test's two priority slots an insertion mark answers for.
// Insertions are tested twice in `hitTestCigarItem` — a large insertion's
// labelled box wins over a mismatch, a small one's thin bar loses to it — and
// the slot depends on the zoom, so it gates the click and not the draw.
export const InsertionSlot = { all: 0, small: 1, large: 2 } as const

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

export interface PointRules {
  rule: (typeof Point)[keyof typeof Point]
  // The insertion bar's drawn height: `insertionBarWidth` gates the wide
  // count-label box on the row being tall enough to draw a count in, so a
  // compact pileup's hit target narrows with its ink.
  barHeight: number
  slot: (typeof InsertionSlot)[keyof typeof InsertionSlot]
}

// Where a mark's colour comes from. `palette` indexes the two tables by a byte
// the feature already holds; `packedAbgr` formats the worker's own u32 per RUN,
// since that palette is a per-read choice rather than a small table.
export const Paint = { palette: 0, packedAbgr: 1 } as const
export type PaintRule = (typeof Paint)[keyof typeof Paint]

/**
 * The colours ONE draw call paints with, resolved per frame. Colour is data for
 * the same reason the fades are: a closure here is a call per instance in the
 * hot loop, and it measured as most of the paint — 54 ms of a mismatch layer's
 * 66, on 100K instances.
 *
 * Two tables because the opaque case is the common one once zoomed in and wants
 * a whole string the caller built once, where a genuinely faded mark is
 * `rgbaPrefix255`'s head rejoined with its own alpha — one number converted per
 * instance instead of four, which was 42 ms of a 100K-instance gap layer.
 * `keys` indexes both, and is undefined for a layer that draws one colour;
 * under `Paint.packedAbgr` it IS the colour.
 */
export interface MarkPaint {
  rule: PaintRule
  keys: ArrayLike<number> | undefined
  opaqueCss: readonly string[]
  fadedCss: readonly string[]
}

// One feature's mark, as its three consumers need it.
export interface PileupMark<Data> {
  shape: MarkShape
  channels: (data: Data) => MarkChannels
  fade: FadeRule
  hit: HitRule
  band: BandRule
  // Half a pixel of overdraw for the layers that paint an unbroken wall of
  // abutting cells: Canvas2D anti-aliases each cell's fractional edges and two
  // abutting AA'd edges do not sum to full opacity, leaving a hairline seam. The
  // GPU tiles pixel-snapped quads seamlessly and needs none of it, which is why
  // it is stated here and not in a `.slang`. Sparse marks never abut.
  contiguous: boolean
  point?: PointRules
}

function hitPasses(
  hit: HitRule,
  point: PointRules | undefined,
  channels: MarkChannels,
  index: number,
  coords: CigarCoords,
  filterByFrequency: boolean,
): boolean {
  const { bpPerPx } = coords
  switch (hit) {
    case Hit.always: {
      return true
    }
    case Hit.frequency: {
      return passesFrequencyGate(
        bpPerPx,
        channels.freqs![index]!,
        filterByFrequency,
      )
    }
    case Hit.spanFrequency: {
      const offset = index * channels.stride
      const length =
        channels.positions[offset + 1]! - channels.positions[offset]!
      return passesFrequencyGate(
        length > 0 ? bpPerPx / length : bpPerPx,
        channels.freqs![index]!,
        filterByFrequency,
      )
    }
    case Hit.insertion: {
      const length = channels.lengths![index]!
      const pxPerBp = 1 / bpPerPx
      // An insertion the renderer has faded out for being unresolvable at this
      // zoom must not intercept clicks either, or a whole-genome view is
      // carpeted in invisible hit targets.
      if (insertionSizeAlpha(length, pxPerBp) === 0) {
        return false
      }
      const slot = point!.slot
      const isSmall = getInsertionType(length, pxPerBp) === 'small'
      if (
        slot === InsertionSlot.small
          ? !isSmall
          : slot === InsertionSlot.large && isSmall
      ) {
        return false
      }
      // Away from base-level zoom only a high-frequency small insertion may
      // intercept a click, so the read body stays easy to click through. A large
      // insertion is never frequency-gated, matching its fade.
      return (
        !isSmall ||
        passesFrequencyGate(bpPerPx, channels.freqs![index]!, filterByFrequency)
      )
    }
  }
}

// THE width: the painter fills it and the tolerance below measures from it, so
// the box a person sees and the box they can click are one expression apart. The
// GPU sizes its own quad from the shader's twin of the same rule.
function pointWidthPx(
  point: PointRules,
  channels: MarkChannels,
  index: number,
  pxPerBp: number,
) {
  return point.rule === Point.insertionBar
    ? insertionBarWidth(channels.lengths![index]!, pxPerBp, point.barHeight)
    : CLIP_BAR_WIDTH_PX
}

// Wider than the ink on purpose — a 1px bar is not a clickable target — which is
// why the drawn rect is the floor of the draw-against-hit gate, not its bound.
function pointToleranceBp(
  point: PointRules,
  channels: MarkChannels,
  index: number,
  bpPerPx: number,
) {
  return point.rule === Point.insertionBar
    ? (pointWidthPx(point, channels, index, 1 / bpPerPx) / 2 +
        INSERTION_HIT_SLOP_PX) *
        bpPerPx
    : Math.max(CLIP_HIT_MIN_TOLERANCE_BP, bpPerPx * CLIP_HIT_TOLERANCE_PX)
}

// Whether entry `index` belongs to this mark. One spelling for the two walkers
// and every packer, so a feature whose kinds are separate layers cannot have one
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
export function countMarks<Data>(mark: PileupMark<Data>, data: Data) {
  const { kinds, kind, start, end } = mark.channels(data)
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

/**
 * Paint every instance of `mark` into `ctx`.
 *
 * The projection, the reversed-block edge ordering, the row band and the
 * sub-pixel widening are stated here once for every feature that draws a span:
 * `fillSpanRect` widens a sub-pixel mark to 1px CENTERED on its span, which is
 * what `expandMinWidthX` does on the GPU, and getting that pivot half-right at
 * one call site out of five is a bug this repo has shipped twice.
 *
 * The loop holds no callback: `paint` states where the fill comes from and the
 * mark states its fade, so the only calls per instance are to the module-level
 * rules and the generated scalar twins.
 *
 * `decorate` is the point glyph's second half. The shape library's point IS the
 * centred bar, drawn here from the mark's width rule so one expression serves
 * both features; anything a feature draws ON that bar is its own, and
 * insertion's serif caps are the only such thing in tree.
 */
export function paintMarks<Data>(
  ctx: Ctx2D,
  mark: PileupMark<Data>,
  data: Data,
  frame: MarkFrame,
  state: RenderState,
  paint: MarkPaint,
  decorate?: (
    ctx: Ctx2D,
    xCenter: number,
    top: number,
    height: number,
    data: Data,
    index: number,
    pxPerBp: number,
  ) => void,
) {
  const { block, bpLength, fullBlockWidth } = frame
  const { shape, fade, point } = mark
  const channels = mark.channels(data)
  const { positions, stride, rows, kinds, kind, freqs, quals, lengths, end } =
    channels
  const { rule: paintRule, keys, opaqueCss, fadedCss } = paint
  const featureHeight = state.featureHeight
  const mismatchAlpha = state.mismatchAlpha
  const chainMode = state.chainMode
  // The two rules with no per-instance input, resolved once for the walk.
  const constantAlpha = fade === Fade.intron ? intronAlpha(featureHeight) : 1
  const pxPerBp = fullBlockWidth / bpLength
  const centerline = mark.band === Band.centerline
  const bandOffset = centerline ? featureHeight / 2 - 0.5 : 0
  const bandHeight = centerline ? 1 : featureHeight
  // A layer whose fade has no per-instance input and whose palette has no key
  // draws one colour for the whole walk, so the string is built once and the
  // assignment leaves the loop: an intron centerline and a deletion bar are the
  // two, and formatting per gap was this pass's only per-item string work.
  const constantCss =
    keys === undefined && (fade === Fade.opaque || fade === Fade.intron)
      ? constantAlpha >= 1
        ? opaqueCss[0]!
        : `${fadedCss[0]!}${constantAlpha})`
      : undefined
  if (constantCss !== undefined) {
    ctx.fillStyle = constantCss
  }
  // The densest array the display produces draws from a handful of colours in
  // per-read runs, so `abgrToCssRgba` runs once per run rather than per mark.
  // The comparison is on the u32, not the string.
  let lastKey = -1
  let lastCss = ''
  // One mapper per draw call rather than per instance — `makeCellLeftMapper`
  // owns the reversed-block pivot every one of the five cell painters had wrong
  // at once.
  const cell =
    shape === 'cell'
      ? makePileupCellMapper(block, bpLength, fullBlockWidth, mark.contiguous)
      : undefined
  for (let i = channels.start; i < end; i++) {
    if (markSelects(kinds, kind, i)) {
      const rowY = pileupRowY(rows[i]!, state)
      if (!pileupRowOffCanvas(rowY, state)) {
        const offset = i * stride
        const startBp = positions[offset]!
        // What the mark occupies on screen: its TRUE genomic span for a span or
        // a cell — gap.slang spells this same product, and a drawn width that
        // has been clamped or seam-fudged is deliberately not it — and for a
        // point, which has no span, the width its own rule draws.
        const widthPx =
          point === undefined
            ? ((stride === 2 ? positions[offset + 1]! : startBp + 1) -
                startBp) *
              pxPerBp
            : pointWidthPx(point, channels, i, pxPerBp)
        let alpha = constantAlpha
        switch (fade) {
          case Fade.opaque:
          case Fade.intron: {
            break
          }
          case Fade.spanFrequencySize: {
            alpha =
              frequencyFade(state, widthPx * widthPx, freqs![i]!) *
              sizeAlpha(widthPx)
            break
          }
          case Fade.cellFrequencyQuality: {
            alpha =
              frequencyFade(state, widthPx, freqs![i]!) *
              qualityFade(quals![i]!, mismatchAlpha)
            break
          }
          case Fade.overlap: {
            alpha = chainMode ? overlapFade(widthPx) : overlapAlpha(widthPx)
            break
          }
          case Fade.insertion: {
            const length = lengths![i]!
            alpha =
              (length >= LONG_INSERTION_MIN_LENGTH
                ? 1
                : frequencyFade(state, pxPerBp * pxPerBp, freqs![i]!)) *
              insertionSizeAlpha(length, pxPerBp)
            break
          }
          case Fade.pointFrequency: {
            alpha = frequencyFade(state, pxPerBp, freqs![i]!)
            break
          }
        }
        if (alpha > 0) {
          if (constantCss === undefined) {
            const key = keys === undefined ? 0 : keys[i]!
            if (paintRule === Paint.packedAbgr) {
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
          const top = rowY + bandOffset
          if (point !== undefined) {
            // Centred on the bp edge, which is where the mark IS: there are no
            // two edges to order, so a reversed block needs nothing here.
            const x = bpToScreenX(startBp, block, bpLength, fullBlockWidth)
            ctx.fillRect(x - widthPx / 2, top, widthPx, bandHeight)
            decorate?.(ctx, x, top, bandHeight, data, i, pxPerBp)
          } else if (cell !== undefined) {
            ctx.fillRect(cell.cellX(startBp), top, cell.w, bandHeight)
          } else {
            const x1 = bpToScreenX(startBp, block, bpLength, fullBlockWidth)
            const x2 = bpToScreenX(
              positions[offset + 1]!,
              block,
              bpLength,
              fullBlockWidth,
            )
            // A reversed (flipped) region maps startBp to the larger screen x,
            // so the edges are ordered here rather than by each consumer.
            const lo = x1 < x2 ? x1 : x2
            const hi = x1 < x2 ? x2 : x1
            fillSpanRect(ctx, lo, hi, top, bandHeight)
          }
        }
      }
    }
  }
}

/**
 * The instance of `mark` under the cursor, or undefined for none.
 *
 * Topmost, not first — the scan runs backwards for the reason `findTopmostOnRow`
 * states: on a collapsed group every read sits on row 0, so scanning forwards
 * answers with the mark of a read painted under the one `hitTestFeature` names
 * alongside it.
 *
 * The containment test is the painter's own pivot read back — see `MarkShape`,
 * which is where the two are one decision — so the two cannot disagree about
 * which bases a mark occupies. That is the drift with no cross-backend gate,
 * because every gate this repo has is GPU vs Canvas2D.
 */
export function findMarkAt<Data>(
  mark: PileupMark<Data>,
  data: Data,
  coords: CigarCoords,
  filterByFrequency: boolean,
) {
  const { shape, hit, point } = mark
  const channels = mark.channels(data)
  const { positions, stride, rows, kinds, kind, start } = channels
  const { basePos, genomicPos, bpPerPx, row } = coords
  const isCell = shape === 'cell'
  for (let i = channels.end - 1; i >= start; i--) {
    if (rows[i] === row && markSelects(kinds, kind, i)) {
      const offset = i * stride
      const startBp = positions[offset]!
      const contains =
        point !== undefined
          ? Math.abs(genomicPos - startBp) <
            pointToleranceBp(point, channels, i, bpPerPx)
          : isCell
            ? basePos === startBp
            : genomicPos >= startBp && genomicPos < positions[offset + 1]!
      if (
        contains &&
        hitPasses(hit, point, channels, i, coords, filterByFrequency)
      ) {
        return i
      }
    }
  }
  return undefined
}
