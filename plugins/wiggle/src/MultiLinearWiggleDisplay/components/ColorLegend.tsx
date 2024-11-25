import React from 'react'
import { observer } from 'mobx-react'

// locals
import RectBg from './RectBg'
import type { WiggleDisplayModel } from '../model'

const ColorLegend = observer(function ({
  model,
  rowHeight,
  labelWidth,
  exportSVG,
}: {
  model: WiggleDisplayModel
  rowHeight: number
  labelWidth: number
  exportSVG?: boolean
}) {
  const {
    needsCustomLegend,
    needsScalebar,
    needsFullHeightScalebar,
    rowHeightTooSmallForScalebar,
    renderColorBoxes,
    sources,
  } = model
  const svgFontSize = Math.min(rowHeight, 12)
  const canDisplayLabel = rowHeight > 11
  const colorBoxWidth = renderColorBoxes ? 15 : 0
  const legendWidth = labelWidth + colorBoxWidth + 5
  const svgOffset = exportSVG ? 10 : 0
  const extraOffset =
    svgOffset || (needsScalebar && !rowHeightTooSmallForScalebar ? 50 : 0)

  return sources ? (
    <>
      {
        /* 0.25 for hanging letters like g */
        needsFullHeightScalebar ? (
          <RectBg
            y={0}
            x={extraOffset}
            width={legendWidth}
            height={(sources.length + 0.25) * rowHeight}
          />
        ) : null
      }
      {sources.map((source, idx) => {
        const boxHeight = Math.min(20, rowHeight)
        return (
          <React.Fragment key={`${source.name}-${idx}`}>
            {needsFullHeightScalebar ? null : (
              <RectBg
                y={idx * rowHeight + 1}
                x={extraOffset}
                width={legendWidth}
                height={boxHeight}
              />
            )}
            {source.color ? (
              <RectBg
                y={idx * rowHeight + 1}
                x={extraOffset}
                width={colorBoxWidth}
                height={needsCustomLegend ? rowHeight : boxHeight}
                color={source.color}
              />
            ) : null}
            {canDisplayLabel ? (
              <text
                y={idx * rowHeight + 13}
                x={extraOffset + colorBoxWidth + 2}
                fontSize={svgFontSize}
              >
                {source.name}
              </text>
            ) : null}
          </React.Fragment>
        )
      })}
    </>
  ) : null
})

export default ColorLegend
