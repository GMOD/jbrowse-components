import { createJBrowseTheme } from '@jbrowse/core/ui'
import {
  complement,
  defaultStarts,
  defaultStops,
  getContainingView,
  revcom,
} from '@jbrowse/core/util'

import {
  buildColorPalette,
  buildSequenceGeometry,
  codonTable,
} from './components/drawSequenceWebGL.ts'

import type { SequenceRegionData } from './model.ts'
import type { Frame } from '@jbrowse/core/util'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

interface SequenceDisplayModel {
  height: number
  sequenceData: Map<number, SequenceRegionData>
  showForwardActual: boolean
  showReverseActual: boolean
  showTranslationActual: boolean
  sequenceType: string
  rowHeight: number
}

function renderRects(
  rectBuf: Float32Array,
  colorBuf: Uint8Array,
  instanceCount: number,
  basePx: number,
  bpPerPx: number,
  showBorders: boolean,
) {
  let content = ''
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

    content += `<rect x="${x}" y="${yPx}" width="${w}" height="${hPx}" fill="rgb(${r},${g},${b})"`
    if (showBorders && hasBorder) {
      content += ` stroke="rgb(85,85,85)" stroke-width="1"`
    }
    content += `/>`
  }
  return content
}

function renderBaseLetters(
  seq: string,
  seqStart: number,
  y: number,
  rowHeight: number,
  bpPerPx: number,
  offsetPx: number,
  baseColors: Map<string, readonly [number, number, number]>,
) {
  let content = ''
  const w = 1 / bpPerPx
  const fontSize = rowHeight - 2

  for (const [i, letter] of seq.split('').entries()) {
    const x = (seqStart + i) / bpPerPx - offsetPx
    const cx = x + w / 2
    const cy = y + rowHeight / 2
    const rgb = baseColors.get(letter.toUpperCase())
    const lum = rgb ? (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000 : 255
    const fill = lum < 128 ? '#fff' : '#000'

    content += `<text x="${cx}" y="${cy}" dominant-baseline="middle" text-anchor="middle" font-size="${fontSize}" fill="${fill}">${letter}</text>`
  }
  return content
}

function renderTranslationLetters(
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
  let content = ''
  const normalizedFrame = Math.abs(frame) - 1
  const seqFrame = seqStart % 3
  const frameShift = (normalizedFrame - seqFrame + 3) % 3
  const frameShiftAdjustedSeqLength = seq.length - frameShift
  const multipleOfThreeLength =
    frameShiftAdjustedSeqLength - (frameShiftAdjustedSeqLength % 3)
  const sliceEnd = frameShift + multipleOfThreeLength

  const codonWidth = 3 / bpPerPx
  const fontSize = rowHeight - 2

  for (let i = frameShift; i < sliceEnd; i += 3) {
    const codon = seq.slice(i, i + 3)
    const normalizedCodon = reversed ? revcom(codon) : codon
    const letter = codonTable[normalizedCodon] || ''
    const upperCodon = normalizedCodon.toUpperCase()

    const x = (seqStart + i) / bpPerPx - offsetPx
    const cx = x + codonWidth / 2
    const cy = y + rowHeight / 2

    const isStart = defaultStarts.includes(upperCodon)
    const isStop = defaultStops.includes(upperCodon)
    const fill = isStart
      ? startCodonContrastColor
      : isStop
        ? stopCodonContrastColor
        : '#000'

    content += `<text x="${cx}" y="${cy}" dominant-baseline="middle" text-anchor="middle" font-size="${fontSize}" fill="${fill}">${letter}</text>`
  }
  return content
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
  const showLetters = 1 / bpPerPx >= 12
  const isDna = sequenceType === 'dna'

  const settings = {
    showForward: showForwardActual,
    showReverse: showReverseActual,
    showTranslation: showTranslationActual,
    sequenceType,
    rowHeight,
    colorByCDS: false,
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

  let rectContent = ''
  let textContent = ''

  const baseBp = Math.min(...[...sequenceData.values()].map(d => d.start))

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

    rectContent += renderRects(
      geom.rectBuf,
      geom.colorBuf,
      geom.instanceCount,
      basePx,
      bpPerPx,
      showBorders,
    )

    if (showLetters) {
      const [topFrames, bottomFrames] = reversed
        ? [reverseFrames.toReversed(), forwardFrames.toReversed()]
        : [forwardFrames, reverseFrames]

      let currentY = 0

      for (const frame of topFrames) {
        textContent += renderTranslationLetters(
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
        textContent += renderBaseLetters(
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
        textContent += renderBaseLetters(
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
        textContent += renderTranslationLetters(
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

  return (
    <g>
      <g dangerouslySetInnerHTML={{ __html: rectContent }} />
      <g dangerouslySetInnerHTML={{ __html: textContent }} />
    </g>
  )
}
