import React from 'react'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'
import {
  Feature,
  Region,
  bpSpanPx,
  revcom,
  complement,
  defaultStarts,
  defaultStops,
  defaultCodonTable,
  generateCodonTable,
  Frame,
} from '@jbrowse/core/util'
import { Theme } from '@mui/material'

function Translation(props: {
  codonTable: Record<string, string>
  seq: string
  frame: Frame
  bpPerPx: number
  region: Region
  seqStart: number
  reverse?: boolean
  height: number
  y: number
  theme?: Theme
}) {
  const {
    codonTable,
    seq,
    frame,
    bpPerPx,
    region,
    seqStart,
    height,
    y,
    reverse = false,
    theme,
  } = props
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
    translated.push({ letter: aminoAcid, codon: normalizedCodon.toUpperCase() })
  }

  const width = (region.end - region.start) / bpPerPx
  const codonWidth = (1 / bpPerPx) * 3
  const renderLetter = 1 / bpPerPx >= 12
  const frameOffset = frameShift / bpPerPx
  const startOffset = (region.start - seqStart) / bpPerPx
  const offset = frameOffset - startOffset

  const defaultFill = theme?.palette.frames.at(frame)?.main
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
        if (!(renderLetter || codonFill)) {
          return null
        }
        return (
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
                y={y + height / 2}
                dominantBaseline="middle"
                textAnchor="middle"
                style={{ userSelect: 'none' }}
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

function DNA(props: {
  seq: string
  theme: Theme
  bpPerPx: number
  height: number
  region: Region
  feature: Feature
  y: number
}) {
  const { bpPerPx, region, feature, theme, height, seq, y } = props
  const render = 1 / bpPerPx >= 12

  const [leftPx, rightPx] = bpSpanPx(
    feature.get('start'),
    feature.get('end'),
    region,
    bpPerPx,
  )
  const reverse = region.reversed
  const len = feature.get('end') - feature.get('start')
  const w = Math.max((rightPx - leftPx) / len, 0.8)

  return (
    <>
      {seq.split('').map((letter, index) => {
        // @ts-expect-error
        const color = theme.palette.bases[letter.toUpperCase()]
        const x = reverse ? rightPx - (index + 1) * w : leftPx + index * w
        return (
          <React.Fragment key={index}>
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
                fill={
                  color ? theme.palette.getContrastText(color.main) : 'black'
                }
                style={{ userSelect: 'none' }}
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
  features = new Map(),
  showReverse = true,
  showForward = true,
  showTranslation = true,
  bpPerPx,
  rowHeight,
}: {
  regions: Region[]
  theme?: Theme
  features: Map<string, Feature>
  showReverse?: boolean
  showForward?: boolean
  showTranslation?: boolean
  bpPerPx: number
  rowHeight: number
}) {
  const [region] = regions
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

  const showDNA = bpPerPx <= 1

  const forwardFrames: Frame[] = showTranslation && showForward ? [3, 2, 1] : []
  const reverseFrames: Frame[] =
    showTranslation && showReverse ? [-1, -2, -3] : []
  // the upper translation row. if the view is reversed, the reverse translation
  // is on the top
  const topFrames = region.reversed ? reverseFrames.toReversed() : forwardFrames
  // the lower translation row. if the view is reversed, the forward translation
  // is on the bottom
  const bottomFrames = region.reversed
    ? forwardFrames.toReversed()
    : reverseFrames
  return (
    <>
      {topFrames.map(index => (
        <Translation
          key={`translation-${index}`}
          seq={seq}
          y={(currY += rowHeight)}
          codonTable={codonTable}
          frame={index as Frame}
          bpPerPx={bpPerPx}
          region={region}
          seqStart={feature.get('start')}
          theme={theme}
          height={rowHeight}
          reverse={region.reversed}
        />
      ))}

      {showForward && showDNA ? (
        <DNA
          height={rowHeight}
          y={(currY += rowHeight)}
          feature={feature}
          region={region}
          seq={region.reversed ? complement(seq) : seq}
          bpPerPx={bpPerPx}
          theme={theme}
        />
      ) : null}

      {showReverse && showDNA ? (
        <DNA
          height={rowHeight}
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
          seq={seq}
          y={(currY += rowHeight)}
          codonTable={codonTable}
          frame={index as Frame}
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
    <>{children}</>
  ) : (
    <svg
      data-testid="sequence_track"
      width={width}
      height={totalHeight}
      style={{
        width,
        height: totalHeight,
        userSelect: 'none',
        display: 'block',
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
  const [region] = regions
  const width = (region.end - region.start) / bpPerPx

  return (
    <Wrapper {...props} totalHeight={totalHeight} width={width}>
      <SequenceSVG {...props} />
    </Wrapper>
  )
})

export default DivSequenceRendering
