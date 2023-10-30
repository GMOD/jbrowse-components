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
} from '@jbrowse/core/util'
import { Theme } from '@mui/material'

function Translation({
  codonTable,
  seq,
  frame,
  color,
  bpPerPx,
  region,
  rowHeight,
  y,
  reverse = false,
  theme,
}: {
  codonTable: Record<string, string>
  rowHeight: number
  seq: string
  color?: string
  frame: number
  bpPerPx: number
  region: Region
  reverse?: boolean
  y: number
  theme?: Theme
}) {
  // the tilt variable normalizes the frame to where we are starting from,
  // which increases consistency across blocks
  const tilt = 3 - (region.start % 3)

  // the effectiveFrame incorporates tilt and the frame to say what the
  // effective frame that is plotted. The +3 is for when frame is -2 and this
  // can otherwise result in effectiveFrame -1
  const effectiveFrame = (frame + tilt + 3) % 3

  const seqSliced = seq.slice(effectiveFrame)

  const translated: { letter: string; codon: string }[] = []
  for (let i = 0; i < seqSliced.length; i += 3) {
    const codon = seqSliced.slice(i, i + 3)
    const normalizedCodon = reverse ? revcom(codon) : codon
    const aminoAcid = codonTable[normalizedCodon] || ''
    translated.push({ letter: aminoAcid, codon: normalizedCodon.toUpperCase() })
  }

  const w = (1 / bpPerPx) * 3
  const drop = region.start === 0 ? 0 : w
  const render = 1 / bpPerPx >= 12
  const width = (region.end - region.start) / bpPerPx

  const map = ['#d8d8d8', '#adadad', '#8f8f8f'].reverse()
  return (
    <>
      {translated.map((element, index) => {
        const x = region.reversed
          ? width - (w * (index + 1) + effectiveFrame / bpPerPx - drop)
          : w * index + effectiveFrame / bpPerPx - drop
        const { letter, codon } = element
        return (
          <React.Fragment key={`${index}-${letter}`}>
            <rect
              x={x}
              y={y}
              width={
                render ? w : w + 0.7 /* small fudge factor when zoomed out*/
              }
              height={rowHeight}
              stroke={render ? '#555' : 'none'}
              fill={
                defaultStarts.includes(codon)
                  ? theme?.palette.startCodon
                  : defaultStops.includes(codon)
                  ? theme?.palette.stopCodon
                  : color ?? map[Math.abs(frame)]
              }
            />
            {render ? (
              <text
                x={x + w / 2}
                y={y + rowHeight / 2}
                fontSize={rowHeight - 2}
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

function DNA({
  bpPerPx,
  region,
  feature,
  theme,
  rowHeight,
  seq,
  y,
}: {
  seq: string
  theme: Theme
  bpPerPx: number
  rowHeight: number
  region: Region
  feature: Feature
  y: number
}) {
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
              height={rowHeight}
              fill={color ? color.main : '#aaa'}
              stroke={render ? '#555' : 'none'}
            />
            {render ? (
              <text
                x={x + w / 2}
                y={y + rowHeight / 2}
                fontSize={rowHeight - 2}
                dominantBaseline="middle"
                textAnchor="middle"
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
  features = new Map(),
  showReverse = true,
  showForward = true,
  showTranslation = true,
  rowHeight,
  bpPerPx,
}: {
  regions: Region[]
  theme?: Theme
  features: Map<string, Feature>
  rowHeight: number
  showReverse?: boolean
  showForward?: boolean
  showTranslation?: boolean
  bpPerPx: number
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
  const colors = ['#FF8080', '#80FF80', '#8080FF']

  // incrementer for the y-position of the current sequence being rendered
  // (applies to both translation rows and dna rows)
  let currY = -rowHeight

  return (
    <>
      {/* the upper translation row. if the view is reversed, the reverse
        translation is on the top */}
      {showTranslation && (region.reversed ? showReverse : showForward)
        ? (region.reversed ? [0, -1, -2] : [2, 1, 0]).map(index => (
            <Translation
              key={`translation-${index}`}
              color={colors[region.reversed ? -index : index]}
              seq={seq}
              y={(currY += rowHeight)}
              rowHeight={rowHeight}
              codonTable={codonTable}
              frame={index}
              bpPerPx={bpPerPx}
              region={region}
              theme={theme}
              reverse={region.reversed}
            />
          ))
        : null}

      {showForward ? (
        <DNA
          rowHeight={rowHeight}
          y={(currY += rowHeight)}
          feature={feature}
          region={region}
          seq={region.reversed ? complement(seq) : seq}
          bpPerPx={bpPerPx}
          theme={theme}
        />
      ) : null}

      {showReverse ? (
        <DNA
          rowHeight={rowHeight}
          y={(currY += rowHeight)}
          feature={feature}
          region={region}
          seq={region.reversed ? seq : complement(seq)}
          bpPerPx={bpPerPx}
          theme={theme}
        />
      ) : null}

      {/* the lower translation row. if the view is reversed, the forward
      translation is on the bottom */}
      {showTranslation && (region.reversed ? showForward : showReverse)
        ? (region.reversed ? [2, 1, 0] : [0, -1, -2]).map(index => (
            <Translation
              key={`rev-translation-${index}`}
              seq={seq}
              y={(currY += rowHeight)}
              codonTable={codonTable}
              color={colors[region.reversed ? index : -index]}
              frame={index}
              bpPerPx={bpPerPx}
              region={region}
              theme={theme}
              rowHeight={rowHeight}
              reverse={!region.reversed}
            />
          ))
        : null}
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
      style={{ width, height: totalHeight, userSelect: 'none' }}
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
  config: AnyConfigurationModel
  rowHeight: number
  theme?: Theme
  showForward?: boolean
  showReverse?: boolean
  showTranslation?: boolean
}) {
  const { regions, bpPerPx } = props
  const [region] = regions
  const width = (region.end - region.start) / bpPerPx
  const totalHeight = 200

  return (
    <Wrapper {...props} totalHeight={totalHeight} width={width}>
      <SequenceSVG {...props} />
    </Wrapper>
  )
})

export default DivSequenceRendering
