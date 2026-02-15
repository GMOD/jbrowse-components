import type React from 'react'

import {
  complement,
  defaultStarts,
  defaultStops,
  revcom,
} from '@jbrowse/core/util'
import { useTheme } from '@mui/material'

import { codonTable } from './drawSequenceWebGL.ts'

import type { SequenceRegionData } from '../model.ts'
import type { Frame } from '@jbrowse/core/util'

function TranslationLetters({
  seq,
  seqStart,
  frame,
  y,
  rowHeight,
  bpPerPx,
  offsetPx,
  reversed,
  visibleStartBp,
  visibleEndBp,
}: {
  seq: string
  seqStart: number
  frame: Frame
  y: number
  rowHeight: number
  bpPerPx: number
  offsetPx: number
  reversed: boolean
  visibleStartBp: number
  visibleEndBp: number
}) {
  const normalizedFrame = Math.abs(frame) - 1
  const seqFrame = seqStart % 3
  const frameShift = (normalizedFrame - seqFrame + 3) % 3

  const frameShiftAdjustedSeqLength = seq.length - frameShift
  const multipleOfThreeLength =
    frameShiftAdjustedSeqLength - (frameShiftAdjustedSeqLength % 3)
  const sliceEnd = frameShift + multipleOfThreeLength

  const codonWidth = 3 / bpPerPx
  const fontSize = rowHeight - 2
  const parts: string[] = []

  // clip to visible range (in sequence-local indices)
  const clipStart = Math.max(0, Math.floor(visibleStartBp - seqStart) - 3)
  const clipEnd = Math.min(seq.length, Math.ceil(visibleEndBp - seqStart) + 3)

  // align clipStart to codon boundary within frame
  const rawStart = Math.max(frameShift, clipStart)
  const codonAlignedStart = rawStart - ((rawStart - frameShift) % 3)

  for (let i = codonAlignedStart; i < Math.min(sliceEnd, clipEnd); i += 3) {
    const codon = seq.slice(i, i + 3)
    const normalizedCodon = reversed ? revcom(codon) : codon
    const letter = codonTable[normalizedCodon] || ''
    const upperCodon = normalizedCodon.toUpperCase()

    const x = (seqStart + i) / bpPerPx - offsetPx
    const cx = x + codonWidth / 2
    const cy = y + rowHeight / 2

    const isStart = defaultStarts.includes(upperCodon)
    const isStop = defaultStops.includes(upperCodon)
    const fill = isStart || isStop ? '#fff' : '#000'

    parts.push(
      `<text x="${cx}" y="${cy}" dominant-baseline="middle" text-anchor="middle" font-size="${fontSize}" fill="${fill}">${letter}</text>`,
    )
  }

  return <g dangerouslySetInnerHTML={{ __html: parts.join('') }} />
}

function SequenceLetters({
  seq,
  seqStart,
  y,
  rowHeight,
  bpPerPx,
  offsetPx,
  sequenceType,
  visibleStartBp,
  visibleEndBp,
}: {
  seq: string
  seqStart: number
  y: number
  rowHeight: number
  bpPerPx: number
  offsetPx: number
  sequenceType: string
  visibleStartBp: number
  visibleEndBp: number
}) {
  const theme = useTheme()
  const w = 1 / bpPerPx
  const fontSize = rowHeight - 2
  const parts: string[] = []

  const iStart = Math.max(0, Math.floor(visibleStartBp - seqStart))
  const iEnd = Math.min(seq.length, Math.ceil(visibleEndBp - seqStart))

  for (let i = iStart; i < iEnd; i++) {
    const letter = seq[i]!
    const x = (seqStart + i) / bpPerPx - offsetPx
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

    parts.push(
      `<text x="${cx}" y="${cy}" dominant-baseline="middle" text-anchor="middle" font-size="${fontSize}" fill="${fill}">${letter}</text>`,
    )
  }

  return <g dangerouslySetInnerHTML={{ __html: parts.join('') }} />
}

export default function SequenceLettersOverlay({
  sequenceData,
  offsetPx,
  bpPerPx,
  rowHeight,
  showForward,
  showReverse,
  showTranslation,
  sequenceType,
  displayedRegions,
  width,
  totalHeight,
}: {
  sequenceData: Map<number, SequenceRegionData>
  offsetPx: number
  bpPerPx: number
  rowHeight: number
  showForward: boolean
  showReverse: boolean
  showTranslation: boolean
  sequenceType: string
  displayedRegions: { reversed?: boolean }[]
  width: number
  totalHeight: number
}) {
  const renderLetters = 1 / bpPerPx >= 12

  if (!renderLetters) {
    return null
  }

  const visibleStartBp = offsetPx * bpPerPx
  const visibleEndBp = (offsetPx + width) * bpPerPx

  const isDna = sequenceType === 'dna'
  const showReverseActual = isDna ? showReverse : false
  const showTranslationActual = isDna ? showTranslation : false

  const forwardFrames: Frame[] =
    showTranslationActual && showForward ? [3, 2, 1] : []
  const reverseFrames: Frame[] =
    showTranslationActual && showReverseActual ? [-1, -2, -3] : []

  const elements: React.ReactElement[] = []

  for (const [regionNum, data] of sequenceData) {
    const { seq, start: seqStart } = data
    const reversed = displayedRegions[regionNum]?.reversed ?? false
    const [topFrames, bottomFrames] = reversed
      ? [reverseFrames.toReversed(), forwardFrames.toReversed()]
      : [forwardFrames, reverseFrames]
    let currentY = 0

    for (const frame of topFrames) {
      elements.push(
        <TranslationLetters
          key={`${regionNum}-trans-${frame}`}
          seq={seq}
          seqStart={seqStart}
          frame={frame}
          y={currentY}
          rowHeight={rowHeight}
          bpPerPx={bpPerPx}
          offsetPx={offsetPx}
          reversed={reversed}
          visibleStartBp={visibleStartBp}
          visibleEndBp={visibleEndBp}
        />,
      )
      currentY += rowHeight
    }

    if (showForward) {
      const fwdSeq = reversed ? complement(seq) : seq
      elements.push(
        <SequenceLetters
          key={`${regionNum}-fwd-letters`}
          seq={fwdSeq}
          seqStart={seqStart}
          y={currentY}
          rowHeight={rowHeight}
          bpPerPx={bpPerPx}
          offsetPx={offsetPx}
          sequenceType={sequenceType}
          visibleStartBp={visibleStartBp}
          visibleEndBp={visibleEndBp}
        />,
      )
      currentY += rowHeight
    }

    if (showReverseActual) {
      const revSeq = reversed ? seq : complement(seq)
      elements.push(
        <SequenceLetters
          key={`${regionNum}-rev-letters`}
          seq={revSeq}
          seqStart={seqStart}
          y={currentY}
          rowHeight={rowHeight}
          bpPerPx={bpPerPx}
          offsetPx={offsetPx}
          sequenceType={sequenceType}
          visibleStartBp={visibleStartBp}
          visibleEndBp={visibleEndBp}
        />,
      )
      currentY += rowHeight
    }

    for (const frame of bottomFrames) {
      elements.push(
        <TranslationLetters
          key={`${regionNum}-rev-trans-${frame}`}
          seq={seq}
          seqStart={seqStart}
          frame={frame}
          y={currentY}
          rowHeight={rowHeight}
          bpPerPx={bpPerPx}
          offsetPx={offsetPx}
          reversed={!reversed}
          visibleStartBp={visibleStartBp}
          visibleEndBp={visibleEndBp}
        />,
      )
      currentY += rowHeight
    }
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
