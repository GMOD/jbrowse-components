import React from 'react'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import {
  bpSpanPx,
  revcom,
  complement,
  defaultStarts,
  defaultStops,
  defaultCodonTable,
  generateCodonTable,
} from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region, Frame } from '@jbrowse/core/util'
import type { Theme } from '@mui/material'

function Translation({
  codonTable,
  seq,
  frame,
  bpPerPx,
  colorByCDS,
  region,
  seqStart,
  height,
  y,
  reverse = false,
  theme,
}: {
  codonTable: Record<string, string>
  seq: string
  frame: Frame
  colorByCDS: boolean
  bpPerPx: number
  region: Region
  seqStart: number
  reverse?: boolean
  height: number
  y: number
  theme?: Theme
}) {
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

  const width = (region.end - region.start) / bpPerPx
  const codonWidth = (1 / bpPerPx) * 3
  const renderLetter = 1 / bpPerPx >= 12
  const frameOffset = frameShift / bpPerPx
  const startOffset = (region.start - seqStart) / bpPerPx
  const offset = frameOffset - startOffset
  const defaultFill = colorByCDS
    ? theme?.palette.framesCDS.at(frame)?.main
    : theme?.palette.frames.at(frame)?.main
  return (
    <>
      <rect x={0} y={y} width={width} height={height} fill={defaultFill} />
      {translated.map((element, index) => {
        const x = region.reversed
          ? width - (index + 1) * codonWidth - offset
          : codonWidth * index + offset
        const { letter, codon } = element
        const codonFill = defaultStarts.includes(codon)
          ? theme?.palette.startCodon
          : defaultStops.includes(codon)
            ? theme?.palette.stopCodon
            : undefined
        return !(renderLetter || codonFill) ? null : (
          <React.Fragment key={`${index}-${letter}`}>
            <rect
              x={x}
              y={y}
              width={
                renderLetter
                  ? codonWidth
                  : codonWidth + 0.7 /* small fudge factor when zoomed out*/
              }
              height={height}
              stroke={renderLetter ? '#555' : 'none'}
              fill={codonFill || 'none'}
            />
            {renderLetter ? (
              <text
                x={x + codonWidth / 2}
                fontSize={height - 2}
                y={y + height / 2}
                dominantBaseline="middle"
                textAnchor="middle"
              >
                {letter}
              </text>
            ) : null}
          </React.Fragment>
        )
      })}
    </>
  )
}

function Sequence({
  bpPerPx,
  region,
  feature,
  sequenceType,
  theme,
  height,
  seq,
  y,
}: {
  seq: string
  theme: Theme
  bpPerPx: number
  sequenceType: string
  height: number
  region: Region
  feature: Feature
  y: number
}) {
  const render = 1 / bpPerPx >= 12
  const s = feature.get('start')
  const e = feature.get('end')
  const [leftPx, rightPx] = bpSpanPx(s, e, region, bpPerPx)
  const reverse = region.reversed
  const len = e - s
  const w = Math.max((rightPx - leftPx) / len, 0.8)

  return (
    <>
      {seq.split('').map((letter, index) => {
        const color =
          sequenceType === 'dna'
            ? // @ts-expect-error
              theme.palette.bases[letter.toUpperCase()]
            : undefined
        const x = reverse ? rightPx - (index + 1) * w : leftPx + index * w
        return (
          /* biome-ignore lint/suspicious/noArrayIndexKey: */
          <React.Fragment key={`${letter}-${index}`}>
            <rect
              x={x}
              y={y}
              width={w}
              height={height}
              fill={color ? color.main : '#aaa'}
              stroke={render ? '#555' : 'none'}
            />
            {render ? (
              <text
                x={x + w / 2}
                y={y + height / 2}
                dominantBaseline="middle"
                textAnchor="middle"
                fontSize={height - 2}
                fill={
                  color ? theme.palette.getContrastText(color.main) : 'black'
                }
              >
                {letter}
              </text>
            ) : null}
          </React.Fragment>
        )
      })}
    </>
  )
}

function SequenceSVG({
  regions,
  theme: configTheme,
  colorByCDS,
  features = new Map(),
  showReverse = true,
  showForward = true,
  showTranslation = true,
  sequenceType = 'dna',
  bpPerPx,
  rowHeight,
}: {
  regions: Region[]
  theme?: Theme
  features: Map<string, Feature>
  colorByCDS: boolean
  showReverse?: boolean
  showForward?: boolean
  showTranslation?: boolean
  sequenceType?: string
  bpPerPx: number
  rowHeight: number
}) {
  const region = regions[0]!
  const theme = createJBrowseTheme(configTheme)
  const codonTable = generateCodonTable(defaultCodonTable)
  const [feature] = [...features.values()]
  if (!feature) {
    return null
  }
  const seq: string = feature.get('seq')
  if (!seq) {
    return null
  }

  // incrementer for the y-position of the current sequence being rendered
  // (applies to both translation rows and dna rows)
  let currY = -rowHeight

  const showSequence = bpPerPx <= 1

  const forwardFrames: Frame[] = showTranslation && showForward ? [3, 2, 1] : []
  const reverseFrames: Frame[] =
    showTranslation && showReverse ? [-1, -2, -3] : []

  // if region.reversed, the forward translation is on bottom, reverse on top
  const [topFrames, bottomFrames] = region.reversed
    ? [reverseFrames.toReversed(), forwardFrames.toReversed()]
    : [forwardFrames, reverseFrames]
  return (
    <>
      {topFrames.map(index => (
        <Translation
          key={`translation-${index}`}
          colorByCDS={colorByCDS}
          seq={seq}
          y={(currY += rowHeight)}
          codonTable={codonTable}
          frame={index}
          bpPerPx={bpPerPx}
          region={region}
          seqStart={feature.get('start')}
          theme={theme}
          height={rowHeight}
          reverse={region.reversed}
        />
      ))}

      {showForward && showSequence ? (
        <Sequence
          height={rowHeight}
          sequenceType={sequenceType}
          y={(currY += rowHeight)}
          feature={feature}
          region={region}
          seq={region.reversed ? complement(seq) : seq}
          bpPerPx={bpPerPx}
          theme={theme}
        />
      ) : null}

      {showReverse && showSequence ? (
        <Sequence
          height={rowHeight}
          sequenceType={sequenceType}
          y={(currY += rowHeight)}
          feature={feature}
          region={region}
          seq={region.reversed ? seq : complement(seq)}
          bpPerPx={bpPerPx}
          theme={theme}
        />
      ) : null}

      {bottomFrames.map(index => (
        <Translation
          key={`rev-translation-${index}`}
          colorByCDS={colorByCDS}
          seq={seq}
          y={(currY += rowHeight)}
          codonTable={codonTable}
          frame={index}
          bpPerPx={bpPerPx}
          region={region}
          seqStart={feature.get('start')}
          theme={theme}
          height={rowHeight}
          reverse={!region.reversed}
        />
      ))}
    </>
  )
}

function Wrapper({
  exportSVG,
  width,
  totalHeight,
  children,
}: {
  exportSVG?: { rasterizeLayers: boolean }
  width: number
  totalHeight: number
  children: React.ReactNode
}) {
  return exportSVG ? (
    children
  ) : (
    <svg
      data-testid="sequence_track"
      width={width}
      height={totalHeight}
      style={{
        // use block because svg by default is inline, which adds a margin
        display: 'block',
        width,
        height: totalHeight,
        userSelect: 'none',
      }}
    >
      {children}
    </svg>
  )
}

const DivSequenceRendering = observer(function (props: {
  exportSVG?: { rasterizeLayers: boolean }
  features: Map<string, Feature>
  regions: Region[]
  colorByCDS: boolean
  bpPerPx: number
  rowHeight: number
  sequenceHeight: number
  config: AnyConfigurationModel
  theme?: Theme
  showForward?: boolean
  showReverse?: boolean
  showTranslation?: boolean
}) {
  const { regions, bpPerPx, sequenceHeight } = props
  const region = regions[0]!
  const width = (region.end - region.start) / bpPerPx

  return (
    <Wrapper {...props} totalHeight={sequenceHeight} width={width}>
      <SequenceSVG {...props} />
    </Wrapper>
  )
})

export default DivSequenceRendering
