import { defaultStarts, defaultStops, revcom } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'

import type { Frame, Region } from '@jbrowse/core/util'

export default function Translation({
  codonTable,
  seq,
  frame,
  width,
  bpPerPx,
  colorByCDS,
  region,
  seqStart,
  height,
  y,
  reverse = false,
}: {
  codonTable: Record<string, string>
  width: number
  seq: string
  frame: Frame
  colorByCDS: boolean
  bpPerPx: number
  region: Region
  seqStart: number
  reverse?: boolean
  height: number
  y: number
}) {
  const theme = useTheme()
  const normalizedFrame = Math.abs(frame) - 1
  const seqFrame = seqStart % 3
  const frameShift = (normalizedFrame - seqFrame + 3) % 3

  const frameShiftAdjustedSeqLength = seq.length - frameShift
  const multipleOfThreeLength =
    frameShiftAdjustedSeqLength - (frameShiftAdjustedSeqLength % 3)
  const seqSliced = seq.slice(frameShift, frameShift + multipleOfThreeLength)

  const translated: { letter: string; codon: string }[] = []
  for (let i = 0; i < seqSliced.length; i += 3) {
    const codon = seqSliced.slice(i, i + 3)
    const normalizedCodon = reverse ? revcom(codon) : codon
    const aminoAcid = codonTable[normalizedCodon] || ''
    translated.push({
      letter: aminoAcid,
      codon: normalizedCodon.toUpperCase(),
    })
  }

  const codonWidth = (1 / bpPerPx) * 3
  const renderLetter = 1 / bpPerPx >= 12
  const frameOffset = frameShift / bpPerPx
  const startOffset = (region.start - seqStart) / bpPerPx
  const offset = frameOffset - startOffset
  const defaultFill = colorByCDS
    ? theme.palette.framesCDS.at(frame)?.main
    : theme.palette.frames.at(frame)?.main

  let svg = `<rect x="0" y="${y}" width="${width}" height="${height}" fill="${defaultFill}"/>`

  for (let i = 0, l = translated.length; i < l; i++) {
    const element = translated[i]!
    const x = region.reversed
      ? width - (i + 1) * codonWidth - offset
      : codonWidth * i + offset
    const { letter, codon } = element
    const codonFill = defaultStarts.includes(codon)
      ? theme.palette.startCodon
      : defaultStops.includes(codon)
        ? theme.palette.stopCodon
        : undefined

    if (renderLetter || codonFill) {
      const rectWidth = renderLetter
        ? codonWidth
        : codonWidth + 0.7 /* small fudge factor when zoomed out*/
      const stroke = renderLetter ? '#555' : 'none'
      svg += `<rect x="${x}" y="${y}" width="${rectWidth}" height="${height}" stroke="${stroke}" fill="${codonFill || 'none'}"/>`

      if (renderLetter) {
        svg += `<text x="${x + codonWidth / 2}" font-size="${height - 2}" y="${y + height / 2}" dominant-baseline="middle" text-anchor="middle">${letter}</text>`
      }
    }
  }

  return <g dangerouslySetInnerHTML={{ __html: svg }} />
}
