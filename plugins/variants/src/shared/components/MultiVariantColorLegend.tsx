import { useMemo } from 'react'

import { getFillProps } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import RectBg from './RectBg'

import type { Source } from '../types'

const LegendItem = function ({
  source,
  idx,
  rowHeight,
}: {
  source: Source
  idx: number
  rowHeight: number
}) {
  const { color } = source
  const colorBoxWidth = 15
  return color ? (
    <RectBg
      y={idx * rowHeight}
      x={0}
      width={colorBoxWidth + 0.5}
      height={rowHeight + 0.5}
      color={color}
    />
  ) : null
}

const LegendItemText = function ({
  source,
  idx,
  rowHeight,
  textFillProps,
}: {
  source: Source
  idx: number
  rowHeight: number
  textFillProps: ReturnType<typeof getFillProps>
}) {
  const { color, name, label } = source
  const svgFontSize = Math.min(rowHeight, 12)
  const colorBoxWidth = 15
  return (
    <text
      y={idx * rowHeight + svgFontSize}
      x={color ? colorBoxWidth + 2 : 0}
      fontSize={svgFontSize}
      {...textFillProps}
    >
      {label || name}
    </text>
  )
}

const MultiVariantColorLegend = observer(function ({
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
  const colorBoxWidth = 15
  const theme = useTheme()

  const hasColors = useMemo(
    () => sources?.some(s => s.color) ?? false,
    [sources],
  )
  const legendWidth = labelWidth + (hasColors ? colorBoxWidth + 5 : 0)

  const textFillProps = useMemo(
    () => getFillProps(theme.palette.text.primary),
    [theme.palette.text.primary],
  )

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
      {/* Render all background rectangles first */}
      {sources.map((source, idx) => (
        <LegendItem
          key={`${source.label}-${idx}`}
          source={source}
          idx={idx}
          rowHeight={rowHeight}
        />
      ))}
      {/* Then render all text elements on top */}
      {canDisplayLabels
        ? sources.map((source, idx) => (
            <LegendItemText
              key={`${source.label}-text-${idx}`}
              source={source}
              idx={idx}
              rowHeight={rowHeight}
              textFillProps={textFillProps}
            />
          ))
        : null}
    </>
  ) : null
})

export default MultiVariantColorLegend
