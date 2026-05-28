import { getTickDisplayStr, measureText, stripAlpha } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'

import { makeTicks } from '../util.ts'
import SVGRegionSeparators from './SVGRegionSeparators.tsx'

import type { LinearGenomeViewModel } from '../index.ts'

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
  const theme = useTheme()
  const c = stripAlpha(theme.palette.text.secondary)
  const ticks = makeTicks(start, end, bpPerPx, major, minor).map(tick => ({
    ...tick,
    x: (reversed ? end - tick.base : tick.base - start) / bpPerPx,
  }))
  return (
    <>
      {ticks.map(({ base, type, x }) => (
        <line
          key={`tick-${base}`}
          x1={x}
          x2={x}
          y1={0}
          y2={type === 'major' ? 6 : 4}
          strokeWidth={1}
          stroke={c}
        />
      ))}
      {!hideText
        ? ticks
            .filter(({ type }) => type === 'major')
            .flatMap(({ base, x }) => {
              const label = getTickDisplayStr(base + 1, bpPerPx)
              const labelWidth = measureText(label, 11) + 4
              return x - 3 >= 0 && x - 3 + labelWidth <= widthPx
                ? [
                    <text
                      key={`label-${base}`}
                      x={x - 3}
                      y={7 + 11}
                      fontSize={11}
                      fill={c}
                    >
                      {label}
                    </text>,
                  ]
                : []
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
