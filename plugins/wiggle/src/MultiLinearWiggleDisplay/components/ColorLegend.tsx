import { useMemo } from 'react'

import { getFillProps } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import LegendItem from './LegendItem'
import LegendItemText from './LegendItemText'
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
  const theme = useTheme()

  const textFillProps = useMemo(
    () => getFillProps(theme.palette.text.primary),
    [theme.palette.text.primary],
  )

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
      {/* Render all background rectangles first */}
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
      {/* Then render all text elements on top */}
      {sources.map((source, idx) => (
        <LegendItemText
          key={`${source.name}-text-${idx}`}
          source={source}
          idx={idx}
          model={model}
          rowHeight={rowHeight}
          exportSVG={exportSVG}
          textFillProps={textFillProps}
        />
      ))}
    </>
  ) : null
})

export default ColorLegend
