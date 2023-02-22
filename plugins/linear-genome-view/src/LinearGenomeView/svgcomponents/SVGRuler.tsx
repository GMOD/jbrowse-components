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
      {!hideText
        ? ticks
            .filter(tick => tick.type === 'major')
            .map(tick => {
              const x =
                (reversed ? end - tick.base : tick.base - start) / bpPerPx
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
  return (
    <>
      {contentBlocks.map((block, i) => {
        const { start, end, reversed, offsetPx, refName, widthPx } = block
        const offsetLeft = offsetPx - viewOffsetPx
        const key = `clip-${block.key}`
        const x = offsetLeft / bpPerPx
        return (
          <g key={block.key}>
            <defs>
              <clipPath id={key}>
                <rect x={0} y={0} width={widthPx} height={100} />
              </clipPath>
            </defs>
            <g
              transform={`translate(${offsetLeft} 0)`}
              clipPath={`url(#${key})`}
            >
              {i === 0 ? null : (
                <line
                  x1={x}
                  x2={x}
                  y1={0}
                  y2={30}
                  strokeWidth={2}
                  stroke={theme.palette.text.secondary}
                />
              )}
              <text
                x={x + 4}
                y={fontSize}
                fontSize={fontSize}
                fill={theme.palette.text.primary}
              >
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
        )
      })}
    </>
  )
}
