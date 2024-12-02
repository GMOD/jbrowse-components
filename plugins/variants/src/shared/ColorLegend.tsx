import React from 'react'

import { observer } from 'mobx-react'

import RectBg from './RectBg'

import type { Source } from '../util'

const ColorLegend = observer(function ({
  model,
  labelWidth,
}: {
  model: { rowHeight: number; sources?: Source[] }
  labelWidth: number
}) {
  const { rowHeight, sources } = model
  const svgFontSize = Math.min(rowHeight, 8)
  const canDisplayLabel = rowHeight > 8
  const colorBoxWidth = 15
  const legendWidth = labelWidth + colorBoxWidth + 5

  return sources ? (
    <>
      {canDisplayLabel ? (
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
            {canDisplayLabel ? (
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
