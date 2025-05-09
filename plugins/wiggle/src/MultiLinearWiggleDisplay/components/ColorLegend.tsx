import { observer } from 'mobx-react'

import LegendItem from './LegendItem'
import RectBg from './RectBg'

import type { WiggleDisplayModel } from '../model'

const ColorLegend = observer(function ({
  model,
  rowHeight,
  exportSVG,
}: {
  model: WiggleDisplayModel
  rowHeight: number
  exportSVG?: boolean
}) {
  const {
    graphType,
    needsFullHeightScalebar,
    rowHeightTooSmallForScalebar,
    renderColorBoxes,
    sources,
    labelWidth,
  } = model
  const colorBoxWidth = renderColorBoxes ? 15 : 0
  const legendWidth = labelWidth + colorBoxWidth + 5
  const svgOffset = exportSVG ? 10 : 0
  const extraOffset =
    svgOffset || (graphType && !rowHeightTooSmallForScalebar ? 50 : 0)

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
