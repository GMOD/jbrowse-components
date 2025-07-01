import type { ReactNode } from 'react'
import { Fragment } from 'react'

import {
  bpSpanPx,
  complement,
  defaultCodonTable,
  defaultStarts,
  defaultStops,
  generateCodonTable,
  revcom,
} from '@jbrowse/core/util'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Frame, Region } from '@jbrowse/core/util'

function Translation({
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
  const normalizedFrame = Math.abs(frame) - 1
  const seqFrame = seqStart % 3
  const frameShift = (normalizedFrame - seqFrame + 3) % 3
  const theme = useTheme()

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
  const dark = theme.palette.mode === 'dark' ? 'dark' : 'main'
  const defaultFill = colorByCDS
    ? theme.palette.framesCDS.at(frame)?.[dark]
    : theme.palette.frames.at(frame)?.[dark]
  return (
    <>
      <rect x={0} y={y} width={width} height={height} fill={defaultFill} />
      {translated.map((element, index) => {
        const x = region.reversed
          ? width - (index + 1) * codonWidth - offset
          : codonWidth * index + offset
        const { letter, codon } = element
        const codonFill = defaultStarts.includes(codon)
          ? theme.palette.startCodon
          : defaultStops.includes(codon)
            ? theme.palette.stopCodon
            : undefined
        return !(renderLetter || codonFill) ? null : (
          <Fragment key={`${index}-${letter}`}>
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
          </Fragment>
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
  height,
  seq,
  y,
}: {
  seq: string
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
  const theme = useTheme()
  return (
    <>
      {seq.split('').map((letter, index) => {
        const color =
          sequenceType === 'dna'
            ? // @ts-expect-error
              theme.palette.bases[letter.toUpperCase()]
            : undefined
        const dark = theme.palette.mode === 'dark'
        const x = reverse ? rightPx - (index + 1) * w : leftPx + index * w
        return (
          /* biome-ignore lint/suspicious/noArrayIndexKey: */
          <Fragment key={`${letter}-${index}`}>
            <rect
              x={x}
              y={y}
              width={w}
              height={height}
              fill={color ? (dark ? color.dark : color.main) : '#aaa'}
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
          </Fragment>
        )
      })}
    </>
  )
}

function SequenceSVG({
  regions,
  width,
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
  width: number
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
          width={width}
          colorByCDS={colorByCDS}
          seq={seq}
          y={(currY += rowHeight)}
          codonTable={codonTable}
          frame={index}
          bpPerPx={bpPerPx}
          region={region}
          seqStart={feature.get('start')}
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
        />
      ) : null}

      {bottomFrames.map(index => (
        <Translation
          key={`rev-translation-${index}`}
          width={width}
          colorByCDS={colorByCDS}
          seq={seq}
          y={(currY += rowHeight)}
          codonTable={codonTable}
          frame={index}
          bpPerPx={bpPerPx}
          region={region}
          seqStart={feature.get('start')}
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
  children: ReactNode
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

const DivSequenceRendering = observer(function ({
  exportSVG,
  features,
  regions,
  colorByCDS,
  bpPerPx,
  rowHeight,
  sequenceHeight,
  showForward,
  showReverse,
  showTranslation,
}: {
  exportSVG?: { rasterizeLayers: boolean }
  features: Map<string, Feature>
  regions: Region[]
  colorByCDS: boolean
  bpPerPx: number
  rowHeight: number
  sequenceHeight: number
  config: AnyConfigurationModel
  showForward?: boolean
  showReverse?: boolean
  showTranslation?: boolean
}) {
  const region = regions[0]!
  const width = Math.ceil((region.end - region.start) / bpPerPx)

  return (
    <Wrapper exportSVG={exportSVG} totalHeight={sequenceHeight} width={width}>
      <SequenceSVG
        width={width}
        showReverse={showReverse}
        showForward={showForward}
        showTranslation={showTranslation}
        colorByCDS={colorByCDS}
        bpPerPx={bpPerPx}
        rowHeight={rowHeight}
        features={features}
        regions={regions}
      />
    </Wrapper>
  )
})

export default DivSequenceRendering
