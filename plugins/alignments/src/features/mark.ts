// What one pileup mark COVERS, declared once as DATA. THE derivation — the GPU
// packer, the Canvas2D painter (and through it the SVG export) and the hit test
// all take their arrays, their selection, their gates and their span from here.
//
// They used to each state them. `features/gap` was the smallest complete
// example: three files walking `(gapPositions, gapYs, gapTypes, gapFrequencies)`
// under three spellings of `gapTypes[i] === kind`, three spellings of
// `gapPositions[i * 2]`, and two independently-written gates — one of which had
// to be ADDED to the hit test after the fact, because without it a deletion the
// worker had zeroed went on intercepting every click across its span while the
// shader faded it to four of 255 alpha.
//
// A mark states channels and rule codes rather than callbacks, so `paintMarks`
// and `findMarkAt` walk one struct shape whatever the feature: inside their
// loops there are typed-array reads and calls to the module-level rules below,
// and nothing polymorphic. Ten marks over one shared walker used to mean seven
// megamorphic calls per instance, which cost ~2x the paint.
//
// What this deliberately does NOT do: it is not a transpiled draw stage.
// adr-051 stands — the `.slang` stays hand-written, and the scalar decisions the
// two backends share come across through `//! js-export`. The rules below READ
// those twins (`intronAlpha`, `sizeAlpha`, `frequencyFadeGate`, `qualityFade`,
// `overlapFade`); they do not replace them.
import { fillSpanRect, insertionSizeAlpha } from '@jbrowse/alignments-core'

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

/**
 * A mark's drawn opacity, and the one place each fade curve is spelled.
 *
 * `alpha: Fade.opaque` is a CLAIM each backend has to meet, not a default:
 * writing it down is what found `perBaseLetter` packing a Phred 0 into a shader
 * that fades on quality, so the GPU drew nothing where Canvas2D drew every base.
 */
export function fadeAlpha(
  fade: FadeRule,
  channels: MarkChannels,
  index: number,
  state: RenderState,
  widthPx: number,
  pxPerBp: number,
): number {
  switch (fade) {
    case Fade.opaque: {
      return 1
    }
    case Fade.spanFrequencySize: {
      return (
        frequencyFade(state, widthPx * widthPx, channels.freqs![index]!) *
        sizeAlpha(widthPx)
      )
    }
    case Fade.cellFrequencyQuality: {
      return (
        frequencyFade(state, widthPx, channels.freqs![index]!) *
        qualityFade(channels.quals![index]!, state.mismatchAlpha)
      )
    }
    case Fade.intron: {
      return intronAlpha(state.featureHeight)
    }
    case Fade.overlap: {
      return state.chainMode ? overlapFade(widthPx) : overlapAlpha(widthPx)
    }
    case Fade.insertion: {
      const length = channels.lengths![index]!
      const frequency =
        length >= LONG_INSERTION_MIN_LENGTH
          ? 1
          : frequencyFade(state, pxPerBp * pxPerBp, channels.freqs![index]!)
      return frequency * insertionSizeAlpha(length, pxPerBp)
    }
    case Fade.pointFrequency: {
      return frequencyFade(state, pxPerBp, channels.freqs![index]!)
    }
  }
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
export function markSelects(channels: MarkChannels, index: number) {
  return channels.kinds === undefined || channels.kinds[index] === channels.kind
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
    if (kinds[i] === kind) {
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
  style: (alpha: number, data: Data, index: number) => string,
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
  const { positions, stride, rows, end } = channels
  const featureHeight = state.featureHeight
  const pxPerBp = fullBlockWidth / bpLength
  const centerline = mark.band === Band.centerline
  const bandOffset = centerline ? featureHeight / 2 - 0.5 : 0
  const bandHeight = centerline ? 1 : featureHeight
  // One mapper per draw call rather than per instance — `makeCellLeftMapper`
  // owns the reversed-block pivot every one of the five cell painters had wrong
  // at once.
  const cell =
    shape === 'cell'
      ? makePileupCellMapper(block, bpLength, fullBlockWidth, mark.contiguous)
      : undefined
  for (let i = channels.start; i < end; i++) {
    if (markSelects(channels, i)) {
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
        const alpha = fadeAlpha(fade, channels, i, state, widthPx, pxPerBp)
        if (alpha > 0) {
          ctx.fillStyle = style(alpha, data, i)
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
            fillSpanRect(
              ctx,
              Math.min(x1, x2),
              Math.max(x1, x2),
              top,
              bandHeight,
            )
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
  const { positions, stride, rows, start } = channels
  const { basePos, genomicPos, bpPerPx, row } = coords
  const isCell = shape === 'cell'
  for (let i = channels.end - 1; i >= start; i--) {
    if (rows[i] === row && markSelects(channels, i)) {
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
