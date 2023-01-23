import React from 'react'
import { observer } from 'mobx-react'
import { getTickDisplayStr } from '@jbrowse/core/util'

// locals
import { makeTicks } from '../util'
import { useTheme } from '@mui/material'

export default observer(function Ruler({
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
            stroke={theme.palette.divider}
            data-bp={tick.base}
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
})
