import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { polarToCartesian, radToDeg } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { ringAxisTicks } from './ringHost.ts'

import type { CircularViewModel } from '../CircularView/model.ts'

const TICK_PX = 4

/**
 * Each quantitative ring's y axis, drawn radially in the gap before the first
 * slice so it covers no data. Drawn in the figure's rotated frame; the labels
 * turn back so they stay level on screen.
 */
export const RingAxes = observer(function RingAxes({
  model,
}: {
  model: CircularViewModel
}) {
  const palette = usePalette()
  const { ringHost, offsetRadians, radiusPx, effectiveSpacingPx } = model
  const angle = -effectiveSpacingPx / radiusPx / 2
  const [tx, ty] = [Math.sin(angle), -Math.cos(angle)]
  const labelAnchor =
    Math.cos(angle + offsetRadians - Math.PI / 2) < 0 ? 'end' : 'start'
  const fg = palette.text.secondary
  const bg = palette.background.paper
  const rotation = -radToDeg(offsetRadians)
  const axes = ringHost.rings
    .map(ring => ({ ring, ticks: ringAxisTicks(ring) }))
    .filter(({ ticks }) => ticks.length > 0)
  return axes.length ? (
    <g data-testid="ring-axes" stroke={fg} fontSize={9}>
      {axes.map(({ ring, ticks }) => {
        const [outerX, outerY] = polarToCartesian(ring.outerPx, angle)
        const [innerX, innerY] = polarToCartesian(ring.innerPx, angle)
        return (
          <g key={ring.display.id}>
            <line x1={outerX} y1={outerY} x2={innerX} y2={innerY} />
            {ticks.map(({ radius, label }) => {
              const [x, y] = polarToCartesian(radius, angle)
              const lx = x + tx * (TICK_PX + 2)
              const ly = y + ty * (TICK_PX + 2)
              return (
                <g key={radius}>
                  <line
                    x1={x}
                    y1={y}
                    x2={x + tx * TICK_PX}
                    y2={y + ty * TICK_PX}
                  />
                  {label === undefined ? null : (
                    <text
                      x={lx}
                      y={ly}
                      transform={`rotate(${rotation} ${lx} ${ly})`}
                      textAnchor={labelAnchor}
                      dy="0.32em"
                      fill={fg}
                      stroke={bg}
                      strokeWidth={2.5}
                      paintOrder="stroke"
                    >
                      {label}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        )
      })}
    </g>
  ) : null
})
