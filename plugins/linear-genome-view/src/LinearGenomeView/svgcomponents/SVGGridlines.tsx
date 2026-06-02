import { stripAlpha } from '@jbrowse/core/util'
import { SvgClipRect } from '@jbrowse/core/util/svgExport'
import { useTheme } from '@mui/material'

import { makeTicks } from '../util.ts'

import type { LinearGenomeViewModel } from '../index.ts'

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
        return (
          <g key={key} transform={`translate(${offset} 0)`}>
            <SvgClipRect
              id={`gridline-clip-${key}`}
              width={widthPx}
              height={height}
            >
              {ticks.map(tick => {
                const x =
                  (reversed ? end - tick.base : tick.base - start) / bpPerPx
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
            </SvgClipRect>
          </g>
        )
      })}
    </>
  )
}
