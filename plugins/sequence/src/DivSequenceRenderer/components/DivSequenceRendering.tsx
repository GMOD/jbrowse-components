/* eslint-disable no-nested-ternary,@typescript-eslint/no-explicit-any,no-return-assign */
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import { contrastingTextColor } from '@jbrowse/core/util/color'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { Region } from '@jbrowse/core/util/types'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'
import React from 'react'
import {
  bpSpanPx,
  revcom,
  complement,
  defaultStarts,
  defaultStops,
  defaultCodonTable,
  generateCodonTable,
} from '@jbrowse/core/util'

interface MyProps {
  features: Map<string, Feature>
  regions: Region[]
  bpPerPx: number
  config: AnyConfigurationModel
  highResolutionScaling: number
  theme: any
  showForward: boolean
  showReverse: boolean
  showTranslation: boolean
}

function Translation(props: {
  codonTable: any
  seq: string
  frame: number
  bpPerPx: number
  region: Region
  reverse?: boolean
  height: number
  y: number
  theme?: any
}) {
  const {
    codonTable,
    seq,
    frame,
    bpPerPx,
    region,
    height,
    y,
    reverse = false,
    theme,
  } = props
  const scale = bpPerPx

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

  const w = (1 / scale) * 3
  const drop = region.start === 0 ? 0 : w
  const render = 1 / bpPerPx >= 12
  const width = (region.end - region.start) / bpPerPx

  const map = ['#d8d8d8', '#adadad', '#8f8f8f'].reverse()
  return (
    <>
      {translated.map((element, index) => {
        const x = region.reversed
          ? width - (w * (index + 1) + effectiveFrame / scale - drop)
          : w * index + effectiveFrame / scale - drop
        const { letter, codon } = element
        return (
          <React.Fragment key={`${index}-${letter}`}>
            <rect
              x={x}
              y={y}
              width={
                render ? w : w + 0.7 /* small fudge factor when zoomed out*/
              }
              height={height}
              stroke={render ? '#555' : 'none'}
              fill={
                defaultStarts.includes(codon)
                  ? theme.palette.startCodon
                  : defaultStops.includes(codon)
                  ? theme.palette.stopCodon
                  : map[Math.abs(frame)]
              }
            />
            {render ? (
              <text
                x={x + w / 2}
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

function DNA(props: {
  seq: string
  theme: any
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
                fill={color ? contrastingTextColor(color.main) : 'black'}
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

function Sequence(props: MyProps) {
  const {
    features = new Map(),
    regions,
    bpPerPx,
    theme: configTheme,
    showForward = true,
    showReverse = true,
    showTranslation = true,
  } = props
  const theme = createJBrowseTheme(configTheme)
  const [region] = regions
  const width = (region.end - region.start) / bpPerPx
  const totalHeight = 200
  const codonTable = generateCodonTable(defaultCodonTable)
  const height = 20

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
  let currY = -20

  return (
    <svg
      width={width}
      height={totalHeight}
      style={{ width, height: totalHeight }}
    >
      {/* the upper translation row. if the view is reversed, the reverse
        translation is on the top */}
      {showTranslation && (region.reversed ? showReverse : showForward)
        ? [2, 1, 0].map(index => (
            <Translation
              key={`translation-${index}`}
              seq={seq}
              y={(currY += 20)}
              codonTable={codonTable}
              frame={index}
              bpPerPx={bpPerPx}
              region={region}
              theme={theme}
              height={height}
              reverse={region.reversed}
            />
          ))
        : null}

      {showForward ? (
        <DNA
          height={height}
          y={(currY += 20)}
          feature={feature}
          region={region}
          seq={region.reversed ? complement(seq) : seq}
          bpPerPx={bpPerPx}
          theme={theme}
        />
      ) : null}

      {showReverse ? (
        <DNA
          height={height}
          y={(currY += 20)}
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
        ? [0, -1, -2].map(index => (
            <Translation
              key={`rev-translation-${index}`}
              seq={seq}
              y={(currY += 20)}
              codonTable={codonTable}
              frame={index}
              bpPerPx={bpPerPx}
              region={region}
              theme={theme}
              height={height}
              reverse={!region.reversed}
            />
          ))
        : null}
    </svg>
  )
}

export default observer(Sequence)
