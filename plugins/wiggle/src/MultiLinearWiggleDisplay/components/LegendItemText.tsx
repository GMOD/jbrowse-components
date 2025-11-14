import type { getFillProps } from '@jbrowse/core/util'

import type { Source } from '../../util'
import type { WiggleDisplayModel } from '../model'

const LegendItemText = function ({
  source,
  idx,
  rowHeight,
  model,
  exportSVG,
  textFillProps,
}: {
  source: Source
  idx: number
  rowHeight: number
  model: WiggleDisplayModel
  exportSVG?: boolean
  textFillProps: ReturnType<typeof getFillProps>
}) {
  const { graphType, rowHeightTooSmallForScalebar, renderColorBoxes } = model
  const svgFontSize = Math.min(rowHeight, 12)
  const canDisplayLabel = rowHeight >= 6
  const colorBoxWidth = renderColorBoxes ? 15 : 0
  const svgOffset = exportSVG ? 10 : 0
  const extraOffset =
    svgOffset || (graphType && !rowHeightTooSmallForScalebar ? 50 : 0)

  return canDisplayLabel ? (
    <text
      y={idx * rowHeight + 13}
      x={extraOffset + colorBoxWidth + 2}
      fontSize={svgFontSize}
      {...textFillProps}
    >
      {source.name}
    </text>
  ) : null
}

export default LegendItemText
