import React from 'react'
import { getTickDisplayStr, stripAlpha } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'

// locals
import { makeTicks } from '../util'

import SVGRegionSeparators from './SVGRegionSeparators'
import type { LinearGenomeViewModel } from '..'

type LGV = LinearGenomeViewModel

function Ruler({
  start,
  end,
  bpPerPx,
  reversed = false,
  major = true,
  minor = true,
  hideText = false,
}: {
  start: number
  end: number
  bpPerPx: number
  reversed?: boolean
  major?: boolean
  minor?: boolean
  hideText?: boolean
}) {
  const ticks = makeTicks(start, end, bpPerPx, major, minor)
  const theme = useTheme()
  const c = stripAlpha(theme.palette.text.secondary)
  return (
    <>
      {ticks.map(tick => {
        const x = (reversed ? end - tick.base : tick.base - start) / bpPerPx
        return (
          <line
            key={`tick-${tick.base}`}
            x1={x}
            x2={x}
            y1={0}
            y2={tick.type === 'major' ? 6 : 4}
            strokeWidth={1}
            stroke={c}
          />
        )
      })}
      {!hideText
        ? ticks
            .filter(tick => tick.type === 'major')
            .map(tick => {
              const x =
                (reversed ? end - tick.base : tick.base - start) / bpPerPx
              return (
                <text
                  key={`label-${tick.base}`}
                  x={x - 3}
                  y={7 + 11}
                  fontSize={11}
                  fill={c}
                >
                  {getTickDisplayStr(tick.base + 1, bpPerPx)}
                </text>
              )
            })
        : null}
    </>
  )
}

export default function SVGRuler({
  model,
  fontSize,
}: {
  model: LGV
  fontSize: number
}) {
  const {
    dynamicBlocks: { contentBlocks },
    offsetPx: viewOffsetPx,
    bpPerPx,
  } = model
  const renderRuler = contentBlocks.length < 5
  const theme = useTheme()
  const c = stripAlpha(theme.palette.text.primary)
  return (
    <>
      <SVGRegionSeparators model={model} height={30} />
      {contentBlocks.map(block => {
        const { start, end, key, reversed, offsetPx, refName, widthPx } = block
        const offset = offsetPx - viewOffsetPx
        const clipid = `clip-${key}`
        return (
          <g key={key}>
            <defs>
              <clipPath id={clipid}>
                <rect x={0} y={0} width={widthPx} height={100} />
              </clipPath>
            </defs>
            <g transform={`translate(${offset} 0)`}>
              <g clipPath={`url(#${clipid})`}>
                <text x={4} y={fontSize} fontSize={fontSize} fill={c}>
                  {refName}
                </text>
                <g transform="translate(0 20)">
                  <Ruler
                    hideText={!renderRuler}
                    start={start}
                    end={end}
                    bpPerPx={bpPerPx}
                    reversed={reversed}
                  />
                </g>
              </g>
            </g>
          </g>
        )
      })}
    </>
  )
}
