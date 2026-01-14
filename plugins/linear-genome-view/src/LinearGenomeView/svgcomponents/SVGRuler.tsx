import { getTickDisplayStr, measureText, stripAlpha } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'

import { makeTicks } from '../util.ts'
import SVGRegionSeparators from './SVGRegionSeparators.tsx'

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
  widthPx,
}: {
  start: number
  end: number
  bpPerPx: number
  reversed?: boolean
  major?: boolean
  minor?: boolean
  hideText?: boolean
  widthPx: number
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
            .filter(tick => {
              const x =
                (reversed ? end - tick.base : tick.base - start) / bpPerPx
              const labelText = getTickDisplayStr(tick.base + 1, bpPerPx)
              const labelWidth = measureText(labelText, 11) + 4
              const leftEdge = x - 3
              const rightEdge = leftEdge + labelWidth
              return leftEdge >= 0 && rightEdge <= widthPx
            })
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
                    widthPx={widthPx}
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
