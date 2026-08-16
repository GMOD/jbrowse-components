import { complementTable, revcom } from '@jbrowse/core/util'
import { getGeneticCode } from '@jbrowse/core/util/geneticCodes'
import {
  forEachClippedBlock,
  makeBpMapper,
  pxPerBpOf,
} from '@jbrowse/render-core/canvas2dUtils'

import {
  baseRowComplemented,
  codonKind,
  frameShiftBounds,
  rowLayout,
  visibleCodonRange,
  visibleRange,
} from './sequenceGeometry.ts'

import type { SequenceRegionData } from '../model.ts'
import type {
  ColorPalette,
  RowVisibility,
  SeqColor,
} from './sequenceGeometry.ts'
import type { Frame } from '@jbrowse/core/util'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

const BORDER_COLOR = 'rgb(85,85,85)'

interface BlockScale {
  // width of one bp, in px — constant within a block
  pxPerBp: number
  // left edge of the `bpWidth`-bp span starting at `startBp`
  left: (startBp: number, bpWidth: number) => number
}

/**
 * The bp→px scale for one block, resolved once per block rather than per base.
 *
 * The rows below paint one rect per base and run at up to ~10bp/px across the
 * viewport, so this is deliberately scalar-in/scalar-out — it replaced a helper
 * that re-derived the block scale and allocated an `{x, w}` object per base per
 * row per frame. Same rule as canvas2dUtils' `spanLeft`.
 *
 * `left` takes a span's *start* plus its bp width because a reversed block runs
 * bp leftward: the leftmost edge is then the span's end. That is the one-base
 * pivot `makeCellLeftMapper` / `fillBpSpan` exist to get right, and filling
 * rightward from the raw mapper would cover the neighboring base instead.
 */
function blockScale(block: RenderBlock): BlockScale {
  const toX = makeBpMapper(block)
  const { reversed } = block
  return {
    pxPerBp: pxPerBpOf(block),
    left: (startBp, bpWidth) => toX(reversed ? startBp + bpWidth : startBp),
  }
}

/**
 * Paint one cell of the stack. `label` is the glyph to center in it, or
 * undefined for a plain fill (too zoomed out for letters, or a background band
 * with no codon of its own).
 *
 * The one place a fill and a text color are written to the context, and it
 * takes them as a single {@link SeqColor}: the letter's contrast color used to
 * be looked up from a second structure keyed the same way as the fill, which is
 * how a cell can end up drawing black-on-black.
 */
function paintCell(
  ctx: Ctx2D,
  color: SeqColor,
  label: string | undefined,
  x: number,
  w: number,
  y: number,
  rowHeight: number,
) {
  ctx.fillStyle = color.fill
  ctx.fillRect(x, y, w, rowHeight)
  if (label !== undefined) {
    ctx.strokeRect(x, y, w, rowHeight)
    ctx.fillStyle = color.text
    ctx.fillText(label, x + w / 2, y + rowHeight / 2)
  }
}

interface RowDrawCommon {
  ctx: Ctx2D
  block: RenderBlock
  scale: BlockScale
  seq: string
  seqStart: number
  y: number
  rowHeight: number
  // whether cells are wide enough to carry a border and a letter
  showBorders: boolean
  palette: ColorPalette
  // case-insensitive codon -> amino acid for this region's genetic code, '*' for
  // a stop; varies per refName (e.g. mitochondrial contigs)
  codonTable: Record<string, string>
}

/**
 * `complemented` rather than a pre-complemented string: the row draws at most a
 * viewport's worth of bases, but the fetched region is the *buffered* one, so
 * complementing it up front allocated a whole extra copy of the region per base
 * row per block per frame to read a viewport-sized window out of. Complementing
 * the one letter about to be painted is strictly less work, and it is also how
 * `hoverDetailForRow` resolves the same letter.
 */
function drawBaseRow({
  ctx,
  block,
  scale,
  seq,
  seqStart,
  y,
  rowHeight,
  showBorders,
  isDna,
  complemented,
  palette,
}: RowDrawCommon & { isDna: boolean; complemented: boolean }) {
  const { start, end } = visibleRange(
    block.start,
    block.end,
    seqStart,
    seq.length,
  )
  const { left, pxPerBp } = scale

  for (let i = start; i < end; i++) {
    const fwd = seq[i]!
    const letter = complemented ? (complementTable[fwd] ?? fwd) : fwd
    // a peptide track's residues are not nucleotides — its A/C/G/T are Ala,
    // Cys, Gly and Thr — so only DNA consults the base palette, and everything
    // else takes the neutral fallback rather than four residues at random
    const color =
      (isDna ? palette.bases.get(letter.toUpperCase()) : undefined) ??
      palette.fallback
    const x = left(seqStart + i, 1)
    paintCell(
      ctx,
      color,
      showBorders ? letter : undefined,
      x,
      pxPerBp,
      y,
      rowHeight,
    )
  }
}

function drawTranslationRow({
  ctx,
  block,
  scale,
  seq,
  seqStart,
  frame,
  y,
  rowHeight,
  showBorders,
  palette,
  codonTable,
}: RowDrawCommon & { frame: Frame }) {
  const { left, pxPerBp } = scale
  const bg = palette.frames.get(frame) ?? palette.fallback
  const { frameShift, sliceEnd } = frameShiftBounds(seq, seqStart, frame)
  const band = (startBp: number, bpWidth: number) => {
    paintCell(
      ctx,
      bg,
      undefined,
      left(startBp, bpWidth),
      bpWidth * pxPerBp,
      y,
      rowHeight,
    )
  }

  if (showBorders) {
    // the codon loop paints its own cells, so only the partial codons it skips
    // at either edge need a background of their own
    if (frameShift > 0) {
      band(seqStart, frameShift)
    }
    const trailing = seq.length - sliceEnd
    if (trailing > 0) {
      band(seqStart + sliceEnd, trailing)
    }
  } else {
    band(seqStart, seq.length)
  }

  const { start, end } = visibleCodonRange(
    block.start,
    block.end,
    seqStart,
    seq.length,
    frameShift,
    sliceEnd,
  )
  // a negative frame reads the other strand, so its triplet is the
  // reverse-complement of the forward one — the sign of the frame decides this,
  // not the block's display orientation (hoverDetailForRow says it the same way)
  const revcomCodon = frame < 0
  const codonWidth = 3 * pxPerBp

  for (let i = start; i < end; i += 3) {
    const raw = seq.slice(i, i + 3)
    const codon = revcomCodon ? revcom(raw) : raw
    const kind = codonKind(codon.toUpperCase(), codonTable)
    const cell =
      kind === 'start' ? palette.start : kind === 'stop' ? palette.stop : bg

    // the whole row's background was already painted for normal codons, so the
    // no-border path only has start/stop highlights left to lay over it
    if (showBorders) {
      paintCell(
        ctx,
        cell,
        codonTable[codon] ?? '',
        left(seqStart + i, 3),
        codonWidth,
        y,
        rowHeight,
      )
    } else if (kind !== 'normal') {
      paintCell(
        ctx,
        cell,
        undefined,
        left(seqStart + i, 3),
        codonWidth,
        y,
        rowHeight,
      )
    }
  }
}

export interface DrawSequenceState extends RowVisibility {
  bpPerPx: number
  isDna: boolean
  rowHeight: number
  palette: ColorPalette
  canvasWidth: number
  canvasHeight: number
}

export function drawSequenceBlocks(
  ctx: Ctx2D,
  sequenceData: ReadonlyMap<number, SequenceRegionData>,
  blocks: RenderBlock[],
  state: DrawSequenceState,
) {
  const { bpPerPx, isDna, rowHeight, palette, canvasWidth, canvasHeight } =
    state
  const showBorders = 1 / bpPerPx >= 12

  if (showBorders) {
    // floored at 1px: a configured `height` below ~2px per row makes
    // `rowHeight - 2` negative, and a negative font-size is an *invalid* font
    // string that the context silently ignores — leaving whatever font the
    // previous frame set, i.e. letters far too big for the row rather than
    // letters too small to read.
    ctx.font = `${Math.max(1, Math.min(rowHeight - 2, 14))}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.strokeStyle = BORDER_COLOR
    ctx.lineWidth = 1
  }

  forEachClippedBlock(
    ctx,
    blocks,
    canvasWidth,
    canvasHeight,
    block => sequenceData.get(block.displayedRegionIndex),
    (data, block) => {
      const { reversed } = block
      const common = {
        ctx,
        block,
        scale: blockScale(block),
        seq: data.seq,
        seqStart: data.start,
        rowHeight,
        showBorders,
        palette,
        codonTable: getGeneticCode(data.geneticCodeId).codonTable,
      }

      // `state` supplies the three visibility flags structurally, so the stack
      // painted here is the same list the model measures and the hover indexes
      let y = 0
      for (const row of rowLayout(state, reversed)) {
        if (row.type === 'translation') {
          drawTranslationRow({ ...common, frame: row.frame, y })
        } else {
          drawBaseRow({
            ...common,
            y,
            isDna,
            complemented: baseRowComplemented(row.strand, reversed),
          })
        }
        y += rowHeight
      }
    },
  )
}
