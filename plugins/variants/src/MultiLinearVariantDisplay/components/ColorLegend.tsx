import React from 'react'

import { observer } from 'mobx-react'

import RectBg from './RectBg'

import type { VariantDisplayModel } from '../model'

const ColorLegend = observer(function ({
  model,
  labelWidth,
  exportSVG,
}: {
  model: VariantDisplayModel
  labelWidth: number
  exportSVG?: boolean
}) {
  const { rowHeight, sources } = model
  const svgFontSize = Math.min(rowHeight, 8)
  const canDisplayLabel = rowHeight > 8
  const colorBoxWidth = 15
  const legendWidth = labelWidth + colorBoxWidth + 5
  const svgOffset = exportSVG ? 10 : 0
  const extraOffset = svgOffset

  return sources ? (
    <>
      <RectBg
        y={0}
        x={extraOffset}
        width={legendWidth}
        height={(sources.length + 0.25) * rowHeight}
      />
      {sources.map(({ name, color }, idx) => (
        <React.Fragment key={`${name}-${idx}`}>
          {color ? (
            <RectBg
              y={idx * rowHeight + 1}
              x={extraOffset}
              width={colorBoxWidth}
              height={rowHeight}
              color={color}
            />
          ) : null}
          {canDisplayLabel ? (
            <text
              y={idx * rowHeight + svgFontSize}
              x={extraOffset + colorBoxWidth + 2}
              fontSize={svgFontSize}
            >
              {name}
            </text>
          ) : null}
        </React.Fragment>
      ))}
    </>
  ) : null
})

export default ColorLegend
