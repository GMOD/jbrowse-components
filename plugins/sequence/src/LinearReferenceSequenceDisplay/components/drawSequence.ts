import {
  bpToScreenPx,
  clipBlockForCanvas,
} from '@jbrowse/core/gpu/canvas2dUtils'
import { codonTable, complement, revcom } from '@jbrowse/core/util'

import { frameShiftBounds, startsSet, stopsSet } from './sequenceGeometry.ts'

import type { ColorEntry, ColorPalette } from './sequenceGeometry.ts'
import type { SequenceRegionData } from '../model.ts'
import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'
import type { Frame } from '@jbrowse/core/util'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
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
  const [bpStart, bpEnd] = block.bpRangeX
  const x1 = bpToScreenPx(
    absBp,
    bpStart,
    bpEnd,
    block.screenStartPx,
    block.screenEndPx,
    block.reversed,
  )
  const x2 = bpToScreenPx(
    absBp + bpWidth,
    bpStart,
    bpEnd,
    block.screenStartPx,
    block.screenEndPx,
    block.reversed,
  )
  return x1 < x2 ? { x: x1, w: x2 - x1 } : { x: x2, w: x1 - x2 }
}

function drawBaseRow(
  ctx: Ctx2D,
  block: RenderBlock,
  seq: string,
  seqStart: number,
  y: number,
  rowHeight: number,
  showBorders: boolean,
  sequenceType: string,
  palette: ColorPalette,
  textColors: TextColors,
) {
  const [bpStart, bpEnd] = block.bpRangeX
  const iStart = Math.max(0, Math.floor(bpStart - seqStart))
  const iEnd = Math.min(seq.length, Math.ceil(bpEnd - seqStart))
  const isDna = sequenceType === 'dna'

  for (let i = iStart; i < iEnd; i++) {
    const letter = seq[i]!
    const upper = letter.toUpperCase()
    const color = palette.bases.get(upper) ?? palette.fallback
    const { x, w } = bpRangeToScreen(block, seqStart + i, 1)

    ctx.fillStyle = color.style
    ctx.fillRect(x, y, w, rowHeight)

    if (showBorders) {
      ctx.strokeRect(x, y, w, rowHeight)
      ctx.fillStyle = isDna
        ? (textColors.baseContrast.get(upper) ?? '#000')
        : '#000'
      ctx.fillText(letter, x + w / 2, y + rowHeight / 2)
    }
  }
}

function drawTranslationRow(
  ctx: Ctx2D,
  block: RenderBlock,
  seq: string,
  seqStart: number,
  frame: Frame,
  y: number,
  rowHeight: number,
  reversed: boolean,
  showBorders: boolean,
  palette: ColorPalette,
  textColors: TextColors,
) {
  const bg = palette.frames.get(frame) ?? palette.fallback
  const { frameShift, sliceEnd } = frameShiftBounds(seq, seqStart, frame)
  const [bpStart, bpEnd] = block.bpRangeX

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

  const clipStart = Math.max(0, Math.floor(bpStart - seqStart) - 3)
  const clipEnd = Math.min(seq.length, Math.ceil(bpEnd - seqStart) + 3)
  const rawStart = Math.max(frameShift, clipStart)
  const codonAlignedStart = rawStart - ((rawStart - frameShift) % 3)

  for (let i = codonAlignedStart; i < Math.min(sliceEnd, clipEnd); i += 3) {
    const codon = seq.slice(i, i + 3)
    const normalizedCodon = reversed ? revcom(codon) : codon
    const upperCodon = normalizedCodon.toUpperCase()
    const { x, w } = bpRangeToScreen(block, seqStart + i, 3)

    const isStart = startsSet.has(upperCodon)
    const isStop = stopsSet.has(upperCodon)

    if (showBorders) {
      const color = isStart ? palette.start : isStop ? palette.stop : bg
      ctx.fillStyle = color.style
      ctx.fillRect(x, y, w, rowHeight)
      ctx.strokeRect(x, y, w, rowHeight)
    } else if (isStart) {
      ctx.fillStyle = palette.start.style
      ctx.fillRect(x, y, w, rowHeight)
    } else if (isStop) {
      ctx.fillStyle = palette.stop.style
      ctx.fillRect(x, y, w, rowHeight)
    }

    if (showBorders) {
      const letter = codonTable[normalizedCodon] || ''
      ctx.fillStyle = isStart
        ? textColors.startContrast
        : isStop
          ? textColors.stopContrast
          : '#000'
      ctx.fillText(letter, x + w / 2, y + rowHeight / 2)
    }
  }
}

export interface DrawSequenceState {
  bpPerPx: number
  showForward: boolean
  showReverse: boolean
  showTranslation: boolean
  sequenceType: string
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
    sequenceType,
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

    for (const frame of topFrames) {
      drawTranslationRow(
        ctx,
        block,
        data.seq,
        data.start,
        frame,
        currentY,
        rowHeight,
        reversed,
        showBorders,
        palette,
        textColors,
      )
      currentY += rowHeight
    }

    if (showForward) {
      const fwdSeq = reversed ? complement(data.seq) : data.seq
      drawBaseRow(
        ctx,
        block,
        fwdSeq,
        data.start,
        currentY,
        rowHeight,
        showBorders,
        sequenceType,
        palette,
        textColors,
      )
      currentY += rowHeight
    }

    if (showReverse) {
      const revSeq = reversed ? data.seq : complement(data.seq)
      drawBaseRow(
        ctx,
        block,
        revSeq,
        data.start,
        currentY,
        rowHeight,
        showBorders,
        sequenceType,
        palette,
        textColors,
      )
      currentY += rowHeight
    }

    for (const frame of bottomFrames) {
      drawTranslationRow(
        ctx,
        block,
        data.seq,
        data.start,
        frame,
        currentY,
        rowHeight,
        !reversed,
        showBorders,
        palette,
        textColors,
      )
      currentY += rowHeight
    }

    ctx.restore()
  }
}
