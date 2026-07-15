import { complement, revcom } from '@jbrowse/core/util'
import { getGeneticCode } from '@jbrowse/core/util/geneticCodes'
import {
  bpToScreenPx,
  clipBlockForCanvas,
} from '@jbrowse/render-core/canvas2dUtils'

import {
  codonKind,
  frameShiftBounds,
  visibleCodonRange,
  visibleRange,
} from './sequenceGeometry.ts'

import type { ColorEntry, ColorPalette } from './sequenceGeometry.ts'
import type { SequenceRegionData } from '../model.ts'
import type { Frame } from '@jbrowse/core/util'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'
import type { Theme } from '@mui/material'

const BORDER_COLOR = 'rgb(85,85,85)'

export interface TextColors {
  baseContrast: Map<string, string>
  startContrast: string
  stopContrast: string
}

function contrastColor({ rgb }: ColorEntry) {
  const lum = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000
  return lum < 128 ? '#fff' : '#000'
}

export function buildTextColors(
  palette: ColorPalette,
  theme: Theme,
): TextColors {
  const baseContrast = new Map<string, string>()
  for (const [base, color] of palette.bases) {
    baseContrast.set(base, contrastColor(color))
  }
  return {
    baseContrast,
    startContrast: theme.palette.getContrastText(theme.palette.startCodon),
    stopContrast: theme.palette.getContrastText(theme.palette.stopCodon),
  }
}

function bpRangeToScreen(block: RenderBlock, absBp: number, bpWidth: number) {
  const x1 = bpToScreenPx(
    absBp,
    block.start,
    block.end,
    block.screenStartPx,
    block.screenEndPx,
    block.reversed,
  )
  const x2 = bpToScreenPx(
    absBp + bpWidth,
    block.start,
    block.end,
    block.screenStartPx,
    block.screenEndPx,
    block.reversed,
  )
  return x1 < x2 ? { x: x1, w: x2 - x1 } : { x: x2, w: x1 - x2 }
}

function centerText(
  ctx: Ctx2D,
  text: string,
  x: number,
  w: number,
  y: number,
  rowHeight: number,
  color: string,
) {
  ctx.fillStyle = color
  ctx.fillText(text, x + w / 2, y + rowHeight / 2)
}

interface RowDrawCommon {
  ctx: Ctx2D
  block: RenderBlock
  seq: string
  seqStart: number
  y: number
  rowHeight: number
  showBorders: boolean
  palette: ColorPalette
  textColors: TextColors
  // case-insensitive codon -> amino acid for this region's genetic code, '*' for
  // a stop; varies per refName (e.g. mitochondrial contigs)
  codonTable: Record<string, string>
}

function drawBaseRow({
  ctx,
  block,
  seq,
  seqStart,
  y,
  rowHeight,
  showBorders,
  isDna,
  palette,
  textColors,
}: RowDrawCommon & { isDna: boolean }) {
  const { start, end } = visibleRange(
    block.start,
    block.end,
    seqStart,
    seq.length,
  )

  for (let i = start; i < end; i++) {
    const letter = seq[i]!
    const upper = letter.toUpperCase()
    const color = palette.bases.get(upper) ?? palette.fallback
    const { x, w } = bpRangeToScreen(block, seqStart + i, 1)

    ctx.fillStyle = color.style
    ctx.fillRect(x, y, w, rowHeight)

    if (showBorders) {
      ctx.strokeRect(x, y, w, rowHeight)
      const textColor = isDna
        ? (textColors.baseContrast.get(upper) ?? '#000')
        : '#000'
      centerText(ctx, letter, x, w, y, rowHeight, textColor)
    }
  }
}

function drawTranslationRow({
  ctx,
  block,
  seq,
  seqStart,
  frame,
  y,
  rowHeight,
  reversed,
  showBorders,
  palette,
  textColors,
  codonTable,
}: RowDrawCommon & { frame: Frame; reversed: boolean }) {
  const bg = palette.frames.get(frame) ?? palette.fallback
  const { frameShift, sliceEnd } = frameShiftBounds(seq, seqStart, frame)

  ctx.fillStyle = bg.style
  if (showBorders) {
    if (frameShift > 0) {
      const { x, w } = bpRangeToScreen(block, seqStart, frameShift)
      ctx.fillRect(x, y, w, rowHeight)
    }
    const trailing = seq.length - sliceEnd
    if (trailing > 0) {
      const { x, w } = bpRangeToScreen(block, seqStart + sliceEnd, trailing)
      ctx.fillRect(x, y, w, rowHeight)
    }
  } else {
    const { x, w } = bpRangeToScreen(block, seqStart, seq.length)
    ctx.fillRect(x, y, w, rowHeight)
  }

  const { start, end } = visibleCodonRange(
    block.start,
    block.end,
    seqStart,
    seq.length,
    frameShift,
    sliceEnd,
  )

  for (let i = start; i < end; i += 3) {
    const codon = seq.slice(i, i + 3)
    const normalizedCodon = reversed ? revcom(codon) : codon
    const kind = codonKind(normalizedCodon.toUpperCase(), codonTable)
    const { x, w } = bpRangeToScreen(block, seqStart + i, 3)

    // background was already painted for normal codons, so the no-border path
    // only repaints start/stop highlights
    const cell =
      kind === 'start' ? palette.start : kind === 'stop' ? palette.stop : bg
    if (showBorders) {
      ctx.fillStyle = cell.style
      ctx.fillRect(x, y, w, rowHeight)
      ctx.strokeRect(x, y, w, rowHeight)
      const textColor =
        kind === 'start'
          ? textColors.startContrast
          : kind === 'stop'
            ? textColors.stopContrast
            : '#000'
      centerText(
        ctx,
        codonTable[normalizedCodon] ?? '',
        x,
        w,
        y,
        rowHeight,
        textColor,
      )
    } else if (kind !== 'normal') {
      ctx.fillStyle = cell.style
      ctx.fillRect(x, y, w, rowHeight)
    }
  }
}

export interface DrawSequenceState {
  bpPerPx: number
  showForward: boolean
  showReverse: boolean
  showTranslation: boolean
  isDna: boolean
  rowHeight: number
  palette: ColorPalette
  textColors: TextColors
  canvasWidth: number
  canvasHeight: number
}

export function drawSequenceBlocks(
  ctx: Ctx2D,
  sequenceData: ReadonlyMap<number, SequenceRegionData>,
  blocks: RenderBlock[],
  state: DrawSequenceState,
) {
  const {
    bpPerPx,
    showForward,
    showReverse,
    showTranslation,
    isDna,
    rowHeight,
    palette,
    textColors,
    canvasWidth,
    canvasHeight,
  } = state
  const showBorders = 1 / bpPerPx >= 12

  if (showBorders) {
    ctx.font = `${Math.min(rowHeight - 2, 14)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.strokeStyle = BORDER_COLOR
    ctx.lineWidth = 1
  }

  const forwardFrames: Frame[] = showTranslation && showForward ? [3, 2, 1] : []
  const reverseFrames: Frame[] =
    showTranslation && showReverse ? [-1, -2, -3] : []

  for (const block of blocks) {
    const data = sequenceData.get(block.displayedRegionIndex)
    if (!data) {
      continue
    }
    const clip = clipBlockForCanvas(block, canvasWidth)
    if (!clip) {
      continue
    }
    const { reversed } = block
    const [topFrames, bottomFrames] = reversed
      ? [reverseFrames.toReversed(), forwardFrames.toReversed()]
      : [forwardFrames, reverseFrames]

    ctx.save()
    ctx.beginPath()
    ctx.rect(clip.scissorX, 0, clip.scissorW, canvasHeight)
    ctx.clip()

    let currentY = 0
    const common = {
      ctx,
      block,
      seqStart: data.start,
      rowHeight,
      showBorders,
      palette,
      textColors,
      codonTable: getGeneticCode(data.geneticCodeId).codonTable,
    }

    for (const frame of topFrames) {
      drawTranslationRow({
        ...common,
        seq: data.seq,
        frame,
        y: currentY,
        reversed,
      })
      currentY += rowHeight
    }

    if (showForward) {
      const fwdSeq = reversed ? complement(data.seq) : data.seq
      drawBaseRow({ ...common, seq: fwdSeq, y: currentY, isDna })
      currentY += rowHeight
    }

    if (showReverse) {
      const revSeq = reversed ? data.seq : complement(data.seq)
      drawBaseRow({ ...common, seq: revSeq, y: currentY, isDna })
      currentY += rowHeight
    }

    for (const frame of bottomFrames) {
      drawTranslationRow({
        ...common,
        seq: data.seq,
        frame,
        y: currentY,
        reversed: !reversed,
      })
      currentY += rowHeight
    }

    ctx.restore()
  }
}
