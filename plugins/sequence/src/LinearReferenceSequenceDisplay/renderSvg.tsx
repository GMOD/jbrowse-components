import { createJBrowseTheme } from '@jbrowse/core/ui'
import {
  codonTable,
  complement,
  getContainingView,
  revcom,
} from '@jbrowse/core/util'
import { SvgCanvas } from '@jbrowse/core/util/SvgCanvas'

import {
  buildColorPalette,
  buildSequenceGeometry,
  frameShiftBounds,
  startsSet,
  stopsSet,
} from './components/sequenceGeometry.ts'

import type { SequenceRegionData } from './model.ts'
import type { Frame } from '@jbrowse/core/util'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

interface SequenceDisplayModel {
  id: string
  height: number
  sequenceData: Map<number, SequenceRegionData>
  showForwardActual: boolean
  showReverseActual: boolean
  showTranslationActual: boolean
  sequenceType: string
  rowHeight: number
}

function renderRects(
  ctx: SvgCanvas,
  rectBuf: Float32Array,
  colorBuf: Uint8Array,
  instanceCount: number,
  basePx: number,
  bpPerPx: number,
  showBorders: boolean,
) {
  for (let i = 0; i < instanceCount; i++) {
    const xBpLocal = rectBuf[i * 4]!
    const yPx = rectBuf[i * 4 + 1]!
    const wBp = rectBuf[i * 4 + 2]!
    const hPx = rectBuf[i * 4 + 3]!

    const x = xBpLocal / bpPerPx + basePx
    const w = wBp / bpPerPx
    const r = colorBuf[i * 4]!
    const g = colorBuf[i * 4 + 1]!
    const b = colorBuf[i * 4 + 2]!
    const hasBorder = colorBuf[i * 4 + 3] === 255

    ctx.fillStyle = `rgb(${r},${g},${b})`
    ctx.fillRect(x, yPx, w, hPx)
    if (showBorders && hasBorder) {
      ctx.strokeStyle = 'rgb(85,85,85)'
      ctx.lineWidth = 1
      ctx.strokeRect(x, yPx, w, hPx)
    }
  }
}

function renderBaseLetters(
  ctx: SvgCanvas,
  seq: string,
  seqStart: number,
  y: number,
  rowHeight: number,
  bpPerPx: number,
  offsetPx: number,
  baseColors: Map<string, readonly [number, number, number]>,
) {
  const w = 1 / bpPerPx
  const fontSize = rowHeight - 2
  ctx.font = `${fontSize}px monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  for (let i = 0; i < seq.length; i++) {
    const letter = seq[i]!
    const x = (seqStart + i) / bpPerPx - offsetPx
    const cx = x + w / 2
    const cy = y + rowHeight / 2
    const rgb = baseColors.get(letter.toUpperCase())
    const lum = rgb ? (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000 : 255
    ctx.fillStyle = lum < 128 ? '#fff' : '#000'
    ctx.fillText(letter, cx, cy)
  }
}

function renderTranslationLetters(
  ctx: SvgCanvas,
  seq: string,
  seqStart: number,
  frame: Frame,
  y: number,
  rowHeight: number,
  bpPerPx: number,
  offsetPx: number,
  reversed: boolean,
  startCodonContrastColor: string,
  stopCodonContrastColor: string,
) {
  const { frameShift, sliceEnd } = frameShiftBounds(seq, seqStart, frame)

  const codonWidth = 3 / bpPerPx
  const fontSize = rowHeight - 2
  ctx.font = `${fontSize}px monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  for (let i = frameShift; i < sliceEnd; i += 3) {
    const codon = seq.slice(i, i + 3)
    const normalizedCodon = reversed ? revcom(codon) : codon
    const letter = codonTable[normalizedCodon] || ''
    const upperCodon = normalizedCodon.toUpperCase()

    const x = (seqStart + i) / bpPerPx - offsetPx
    const cx = x + codonWidth / 2
    const cy = y + rowHeight / 2

    const isStart = startsSet.has(upperCodon)
    const isStop = stopsSet.has(upperCodon)
    ctx.fillStyle = isStart
      ? startCodonContrastColor
      : isStop
        ? stopCodonContrastColor
        : '#000'
    ctx.fillText(letter, cx, cy)
  }
}

export async function renderSvg(
  model: SequenceDisplayModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  const view = getContainingView(model) as LGV
  const { sequenceData } = model

  if (sequenceData.size === 0 || view.bpPerPx > 10) {
    return null
  }

  const theme = createJBrowseTheme(opts?.theme)
  const palette = buildColorPalette(theme)
  const { offsetPx, bpPerPx } = view
  const {
    showForwardActual,
    showReverseActual,
    showTranslationActual,
    sequenceType,
    rowHeight,
  } = model

  const showBorders = 1 / bpPerPx >= 12
  const isDna = sequenceType === 'dna'

  const settings = {
    showForward: showForwardActual,
    showReverse: showReverseActual,
    showTranslation: showTranslationActual,
    sequenceType,
    rowHeight,
    showBorders,
  }

  const forwardFrames: Frame[] =
    showTranslationActual && showForwardActual ? [3, 2, 1] : []
  const reverseFrames: Frame[] =
    showTranslationActual && showReverseActual ? [-1, -2, -3] : []

  const startCodonContrastColor = theme.palette.getContrastText(
    theme.palette.startCodon,
  )
  const stopCodonContrastColor = theme.palette.getContrastText(
    theme.palette.stopCodon,
  )

  const rectCtx = new SvgCanvas()
  const textCtx = new SvgCanvas()

  let baseBp = Infinity
  for (const d of sequenceData.values()) {
    if (d.start < baseBp) {
      baseBp = d.start
    }
  }

  for (const [regionNum, data] of sequenceData) {
    const reversed = view.displayedRegions[regionNum]?.reversed ?? false
    const geom = buildSequenceGeometry(
      data,
      settings,
      reversed,
      palette,
      baseBp,
    )
    const basePx = baseBp / bpPerPx - offsetPx

    renderRects(
      rectCtx,
      geom.rectBuf,
      geom.colorBuf,
      geom.instanceCount,
      basePx,
      bpPerPx,
      showBorders,
    )

    if (showBorders) {
      const [topFrames, bottomFrames] = reversed
        ? [reverseFrames.toReversed(), forwardFrames.toReversed()]
        : [forwardFrames, reverseFrames]

      let currentY = 0

      for (const frame of topFrames) {
        renderTranslationLetters(
          textCtx,
          data.seq,
          data.start,
          frame,
          currentY,
          rowHeight,
          bpPerPx,
          offsetPx,
          reversed,
          startCodonContrastColor,
          stopCodonContrastColor,
        )
        currentY += rowHeight
      }

      if (showForwardActual) {
        const fwdSeq = reversed ? complement(data.seq) : data.seq
        renderBaseLetters(
          textCtx,
          fwdSeq,
          data.start,
          currentY,
          rowHeight,
          bpPerPx,
          offsetPx,
          palette.baseColors,
        )
        currentY += rowHeight
      }

      if (showReverseActual && isDna) {
        const revSeq = reversed ? data.seq : complement(data.seq)
        renderBaseLetters(
          textCtx,
          revSeq,
          data.start,
          currentY,
          rowHeight,
          bpPerPx,
          offsetPx,
          palette.baseColors,
        )
        currentY += rowHeight
      }

      for (const frame of bottomFrames) {
        renderTranslationLetters(
          textCtx,
          data.seq,
          data.start,
          frame,
          currentY,
          rowHeight,
          bpPerPx,
          offsetPx,
          !reversed,
          startCodonContrastColor,
          stopCodonContrastColor,
        )
        currentY += rowHeight
      }
    }
  }

  const clipId = `sequence-clip-${model.id}`
  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <rect x={0} y={0} width={view.width} height={model.height} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <g dangerouslySetInnerHTML={{ __html: rectCtx.getSerializedSvg() }} />
        <g dangerouslySetInnerHTML={{ __html: textCtx.getSerializedSvg() }} />
      </g>
    </g>
  )
}
