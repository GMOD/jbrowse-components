import RectBg from './RectBg'

import type { Source } from '../../util'
import type { WiggleDisplayModel } from '../model'

const LegendItem = function ({
  source,
  idx,
  rowHeight,
  labelWidth,
  model,
  exportSVG,
}: {
  source: Source
  idx: number
  rowHeight: number
  labelWidth: number
  model: WiggleDisplayModel
  exportSVG?: boolean
}) {
  const boxHeight = Math.min(20, rowHeight)
  const {
    needsCustomLegend,
    graphType,
    needsFullHeightScalebar,
    rowHeightTooSmallForScalebar,
    renderColorBoxes,
  } = model
  const svgFontSize = Math.min(rowHeight, 12)
  const canDisplayLabel = rowHeight > 11
  const colorBoxWidth = renderColorBoxes ? 15 : 0
  const legendWidth = labelWidth + colorBoxWidth + 5
  const svgOffset = exportSVG ? 10 : 0
  const extraOffset =
    svgOffset || (graphType && !rowHeightTooSmallForScalebar ? 50 : 0)
  return (
    <>
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
    </>
  )
}

export default LegendItem
