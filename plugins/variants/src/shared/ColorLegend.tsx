import React from 'react'

import { clamp } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import RectBg from './RectBg'

import type { Source } from '../util'

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
  const legendWidth = labelWidth + colorBoxWidth + 5

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
        const { color, name } = source
        return (
          <React.Fragment key={`${name}-${idx}`}>
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
                x={colorBoxWidth + 2}
                fontSize={svgFontSize}
              >
                {name}
              </text>
            ) : null}
          </React.Fragment>
        )
      })}
    </>
  ) : null
})

export default ColorLegend
