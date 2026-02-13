import type React from 'react'

import {
  complement,
  defaultStarts,
  defaultStops,
  revcom,
} from '@jbrowse/core/util'
import { useTheme } from '@mui/material'

import { codonTable } from './drawSequenceWebGL.ts'

import type { Frame } from '@jbrowse/core/util'

function TranslationLetters({
  seq,
  seqStart,
  frame,
  y,
  rowHeight,
  bpPerPx,
  regionStart,
  reversed,
}: {
  seq: string
  seqStart: number
  frame: Frame
  y: number
  rowHeight: number
  bpPerPx: number
  regionStart: number
  reversed: boolean
}) {
  const normalizedFrame = Math.abs(frame) - 1
  const seqFrame = seqStart % 3
  const frameShift = (normalizedFrame - seqFrame + 3) % 3

  const frameShiftAdjustedSeqLength = seq.length - frameShift
  const multipleOfThreeLength =
    frameShiftAdjustedSeqLength - (frameShiftAdjustedSeqLength % 3)
  const seqSliced = seq.slice(frameShift, frameShift + multipleOfThreeLength)

  const codonWidth = 3 / bpPerPx
  const fontSize = rowHeight - 2
  let svg = ''

  for (let i = 0; i < seqSliced.length; i += 3) {
    const codon = seqSliced.slice(i, i + 3)
    const normalizedCodon = reversed ? revcom(codon) : codon
    const letter = codonTable[normalizedCodon] || ''
    const upperCodon = normalizedCodon.toUpperCase()
    const bpOffset = seqStart + frameShift + i - regionStart

    const x = reversed
      ? (seq.length - (frameShift + i + 3)) / bpPerPx
      : bpOffset / bpPerPx
    const cx = x + codonWidth / 2
    const cy = y + rowHeight / 2

    const isStart = defaultStarts.includes(upperCodon)
    const isStop = defaultStops.includes(upperCodon)
    const fill = isStart || isStop ? '#fff' : '#000'

    svg += `<text x="${cx}" y="${cy}" dominant-baseline="middle" text-anchor="middle" font-size="${fontSize}" fill="${fill}">${letter}</text>`
  }

  return <g dangerouslySetInnerHTML={{ __html: svg }} />
}

function SequenceLetters({
  seq,
  seqStart,
  y,
  rowHeight,
  bpPerPx,
  regionStart,
  sequenceType,
  reversed,
}: {
  seq: string
  seqStart: number
  y: number
  rowHeight: number
  bpPerPx: number
  regionStart: number
  sequenceType: string
  reversed: boolean
}) {
  const theme = useTheme()
  const w = 1 / bpPerPx
  const fontSize = rowHeight - 2
  let svg = ''

  for (let i = 0; i < seq.length; i++) {
    const letter = seq[i]!
    const bpOffset = seqStart + i - regionStart
    const x = reversed
      ? (seq.length - i - 1) / bpPerPx
      : bpOffset / bpPerPx
    const cx = x + w / 2
    const cy = y + rowHeight / 2

    let fill = 'black'
    if (sequenceType === 'dna') {
      // @ts-expect-error
      const color = theme.palette.bases[letter.toUpperCase()] as
        | { main: string }
        | undefined
      if (color) {
        fill = theme.palette.getContrastText(color.main)
      }
    }

    svg += `<text x="${cx}" y="${cy}" dominant-baseline="middle" text-anchor="middle" font-size="${fontSize}" fill="${fill}">${letter}</text>`
  }

  return <g dangerouslySetInnerHTML={{ __html: svg }} />
}

export default function SequenceLettersOverlay({
  seq,
  seqStart,
  regionStart,
  bpPerPx,
  rowHeight,
  showForward,
  showReverse,
  showTranslation,
  sequenceType,
  reversed,
  width,
  totalHeight,
}: {
  seq: string
  seqStart: number
  regionStart: number
  bpPerPx: number
  rowHeight: number
  showForward: boolean
  showReverse: boolean
  showTranslation: boolean
  sequenceType: string
  reversed: boolean
  width: number
  totalHeight: number
}) {
  const renderLetters = 1 / bpPerPx >= 12

  if (!renderLetters) {
    return null
  }

  const isDna = sequenceType === 'dna'
  const showReverseActual = isDna ? showReverse : false
  const showTranslationActual = isDna ? showTranslation : false

  const forwardFrames: Frame[] =
    showTranslationActual && showForward ? [3, 2, 1] : []
  const reverseFrames: Frame[] =
    showTranslationActual && showReverseActual ? [-1, -2, -3] : []

  const [topFrames, bottomFrames] = reversed
    ? [reverseFrames.toReversed(), forwardFrames.toReversed()]
    : [forwardFrames, reverseFrames]

  const elements: React.ReactElement[] = []
  let currentY = 0

  for (const frame of topFrames) {
    elements.push(
      <TranslationLetters
        key={`trans-${frame}`}
        seq={seq}
        seqStart={seqStart}
        frame={frame}
        y={currentY}
        rowHeight={rowHeight}
        bpPerPx={bpPerPx}
        regionStart={regionStart}
        reversed={reversed}
      />,
    )
    currentY += rowHeight
  }

  if (showForward) {
    const fwdSeq = reversed ? complement(seq) : seq
    elements.push(
      <SequenceLetters
        key="fwd-letters"
        seq={fwdSeq}
        seqStart={seqStart}
        y={currentY}
        rowHeight={rowHeight}
        bpPerPx={bpPerPx}
        regionStart={regionStart}
        sequenceType={sequenceType}
        reversed={reversed}
      />,
    )
    currentY += rowHeight
  }

  if (showReverseActual) {
    const revSeq = reversed ? seq : complement(seq)
    elements.push(
      <SequenceLetters
        key="rev-letters"
        seq={revSeq}
        seqStart={seqStart}
        y={currentY}
        rowHeight={rowHeight}
        bpPerPx={bpPerPx}
        regionStart={regionStart}
        sequenceType={sequenceType}
        reversed={reversed}
      />,
    )
    currentY += rowHeight
  }

  for (const frame of bottomFrames) {
    elements.push(
      <TranslationLetters
        key={`rev-trans-${frame}`}
        seq={seq}
        seqStart={seqStart}
        frame={frame}
        y={currentY}
        rowHeight={rowHeight}
        bpPerPx={bpPerPx}
        regionStart={regionStart}
        reversed={!reversed}
      />,
    )
    currentY += rowHeight
  }

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        width,
        height: totalHeight,
      }}
      width={width}
      height={totalHeight}
    >
      {elements}
    </svg>
  )
}
