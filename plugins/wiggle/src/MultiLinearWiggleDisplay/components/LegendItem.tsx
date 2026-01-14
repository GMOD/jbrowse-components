import RectBg from './RectBg.tsx'

import type { MinimalModel } from './types.ts'
import type { Source } from '../../util.ts'

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
  model: MinimalModel
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
    </>
  )
}

export default LegendItem
