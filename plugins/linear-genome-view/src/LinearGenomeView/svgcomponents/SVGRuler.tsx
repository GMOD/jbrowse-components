import React from 'react'
import { getTickDisplayStr } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'

// locals
import { makeTicks } from '../util'

import { LinearGenomeViewModel } from '..'

type LGV = LinearGenomeViewModel

function Ruler({
  start,
  end,
  bpPerPx,
  reversed = false,
  major = true,
  minor = true,
}: {
  start: number
  end: number
  bpPerPx: number
  reversed?: boolean
  major?: boolean
  minor?: boolean
}) {
  const ticks = makeTicks(start, end, bpPerPx, major, minor)
  const theme = useTheme()
  return (
    <>
      {ticks.map(tick => {
        const x = (reversed ? end - tick.base : tick.base - start) / bpPerPx
        return (
          <line
            key={tick.base}
            x1={x}
            x2={x}
            y1={0}
            y2={tick.type === 'major' ? 6 : 4}
            strokeWidth={1}
            stroke={theme.palette.text.secondary}
          />
        )
      })}
      {ticks
        .filter(tick => tick.type === 'major')
        .map(tick => {
          const x = (reversed ? end - tick.base : tick.base - start) / bpPerPx
          return (
            <text
              x={x - 3}
              y={7 + 11}
              key={`label-${tick.base}`}
              fontSize={11}
              fill={theme.palette.text.primary}
            >
              {getTickDisplayStr(tick.base + 1, bpPerPx)}
            </text>
          )
        })}
    </>
  )
}

export default function SVGRuler({
  model,
  fontSize,
  width,
}: {
  model: LGV
  fontSize: number
  width: number
}) {
  const {
    dynamicBlocks: { contentBlocks },
    offsetPx: viewOffsetPx,
    bpPerPx,
  } = model
  const renderRuler = contentBlocks.length < 5
  const theme = useTheme()
  return (
    <>
      <defs>
        <clipPath id="clip-ruler">
          <rect x={0} y={0} width={width} height={20} />
        </clipPath>
      </defs>
      {contentBlocks.map(block => {
        const { key, start, end, reversed, offsetPx, refName } = block
        const offsetLeft = offsetPx - viewOffsetPx
        return (
          <g key={`${key}`} transform={`translate(${offsetLeft} 0)`}>
            <text
              x={offsetLeft / bpPerPx}
              y={fontSize}
              fontSize={fontSize}
              fill={theme.palette.text.primary}
            >
              {refName}
            </text>
            {renderRuler ? (
              <g transform="translate(0 20)" clipPath="url(#clip-ruler)">
                <Ruler
                  start={start}
                  end={end}
                  bpPerPx={bpPerPx}
                  reversed={reversed}
                />
              </g>
            ) : (
              <line
                strokeWidth={1}
                stroke={theme.palette.text.secondary}
                x1={start / bpPerPx}
                x2={end / bpPerPx}
                y1={20}
                y2={20}
              />
            )}
          </g>
        )
      })}
    </>
  )
}
