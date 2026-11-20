import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { polarToCartesian, radToDeg } from '@jbrowse/core/util'
import { SvgHaloText, TEXT_BASELINE_RATIO } from '@jbrowse/display-ui'
import { observer } from 'mobx-react'

import { ringAxisTicks } from './ringHost.ts'

import type { Ring } from './ringHost.ts'

const TICK_PX = 4
const LABEL_FONT_PX = 9
const LABEL_BASELINE_DROP_PX = LABEL_FONT_PX * (TEXT_BASELINE_RATIO - 0.5)

/**
 * Each quantitative ring's y axis, drawn radially in the gap before the first
 * slice. A ring closed on itself has no gap, so there the axis sits on the
 * origin, over the data. Drawn in the figure's rotated frame; the labels turn
 * back so they stay level on screen.
 */
export const RingAxes = observer(function RingAxes({
  model,
}: {
  model: {
    ringHost: { rings: readonly Ring[] }
    offsetRadians: number
    staticSlices: readonly { endRadians: number }[]
  }
}) {
  const palette = usePalette()
  const { ringHost, offsetRadians, staticSlices } = model
  const angle = ((staticSlices.at(-1)?.endRadians ?? 0) - 2 * Math.PI) / 2
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
    <g data-testid="ring-axes">
      {axes.map(({ ring, ticks }) => {
        const [outerX, outerY] = polarToCartesian(ring.outerPx, angle)
        const [innerX, innerY] = polarToCartesian(ring.innerPx, angle)
        return (
          <g key={ring.display.id}>
            <line x1={outerX} y1={outerY} x2={innerX} y2={innerY} stroke={fg} />
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
                    stroke={fg}
                  />
                  {label === undefined ? null : (
                    <g transform={`rotate(${rotation} ${lx} ${ly})`}>
                      <SvgHaloText
                        x={lx}
                        y={ly + LABEL_BASELINE_DROP_PX}
                        anchor={labelAnchor}
                        fontSize={LABEL_FONT_PX}
                        fill={fg}
                        halo={bg}
                        haloWidth={2.5}
                      >
                        {label}
                      </SvgHaloText>
                    </g>
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
