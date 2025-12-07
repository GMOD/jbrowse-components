import { stripAlpha } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'

import { makeTicks } from '../util'

import type { LinearGenomeViewModel } from '..'

type LGV = LinearGenomeViewModel

export default function SVGGridlines({
  model,
  height,
}: {
  model: LGV
  height: number
}) {
  const {
    dynamicBlocks: { contentBlocks },
    offsetPx: viewOffsetPx,
    bpPerPx,
  } = model
  const theme = useTheme()
  const c = stripAlpha(theme.palette.divider)

  return (
    <>
      {contentBlocks.map(block => {
        const { start, end, key, reversed, offsetPx, widthPx } = block
        const offset = offsetPx - viewOffsetPx
        const ticks = makeTicks(start, end, bpPerPx, true, true)
        const clipid = `gridline-clip-${key}`
        return (
          <g key={key}>
            <defs>
              <clipPath id={clipid}>
                <rect x={0} y={0} width={widthPx} height={height} />
              </clipPath>
            </defs>
            <g transform={`translate(${offset} 0)`} clipPath={`url(#${clipid})`}>
              {ticks.map(tick => {
                const x = (reversed ? end - tick.base : tick.base - start) / bpPerPx
                const isMajor = tick.type === 'major'
                return (
                  <line
                    key={`gridline-${tick.base}`}
                    x1={x}
                    x2={x}
                    y1={0}
                    y2={height}
                    strokeWidth={1}
                    stroke={c}
                    strokeOpacity={isMajor ? 0.3 : 0.15}
                  />
                )
              })}
            </g>
          </g>
        )
      })}
    </>
  )
}
