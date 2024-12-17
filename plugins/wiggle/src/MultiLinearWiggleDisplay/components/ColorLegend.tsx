import { observer } from 'mobx-react'
import RectBg from './RectBg'
import LegendItem from './LegendItem'

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
    needsScalebar,
    needsFullHeightScalebar,
    rowHeightTooSmallForScalebar,
    renderColorBoxes,
    sources,
  } = model
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
      {sources.map((source, idx) => (
        <LegendItem
          key={`${source.name}-${idx}`}
          source={source}
          idx={idx}
          model={model}
          rowHeight={rowHeight}
          exportSVG={exportSVG}
          labelWidth={labelWidth}
        />
      ))}
    </>
  ) : null
})

export default ColorLegend
