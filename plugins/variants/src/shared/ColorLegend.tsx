import { Fragment } from 'react'

import { clamp } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import RectBg from './RectBg'

import type { Source } from '../types'

const ColorLegend = observer(function ({
  model,
  labelWidth,
}: {
  model: {
    canDisplayLabels: boolean
    rowHeight: number
    sources?: Source[]
  }
  labelWidth: number
}) {
  const { canDisplayLabels, rowHeight, sources } = model
  const svgFontSize = clamp(rowHeight, 8, 12)
  const colorBoxWidth = 15
  const hasColors = sources?.some(s => s.color)
  const legendWidth = labelWidth + (hasColors ? colorBoxWidth + 5 : 0)

  return sources ? (
    <>
      {canDisplayLabels ? (
        <RectBg
          y={0}
          x={0}
          width={legendWidth}
          height={(sources.length + 0.25) * rowHeight}
        />
      ) : null}
      {sources.map((source, idx) => {
        const { color, name, label } = source
        return (
          <Fragment key={`${label}-${idx}`}>
            {color ? (
              <RectBg
                y={idx * rowHeight + 1}
                x={0}
                width={colorBoxWidth + 0.5}
                height={rowHeight + 0.5}
                color={color}
              />
            ) : null}
            {canDisplayLabels ? (
              <text
                y={idx * rowHeight + svgFontSize}
                x={color ? colorBoxWidth + 2 : 0}
                fontSize={svgFontSize}
              >
                {label || name}
              </text>
            ) : null}
          </Fragment>
        )
      })}
    </>
  ) : null
})

export default ColorLegend
