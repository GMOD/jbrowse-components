import { useMemo } from 'react'

import { getFillProps } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import RectBg from './RectBg.tsx'

import type { Source } from '../types.ts'

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
  const { color, name } = source
  const svgFontSize = Math.min(rowHeight, 12)
  const colorBoxWidth = 15
  return (
    <text
      y={(idx + 0.5) * rowHeight}
      x={color ? colorBoxWidth + 2 : 0}
      fontSize={svgFontSize}
      dominantBaseline="central"
      {...textFillProps}
    >
      {name}
    </text>
  )
}

const MultiSampleVariantColorLegend = observer(
  function MultiSampleVariantColorLegend({
    model,
    labelWidth,
    startIdx,
    endIdx,
  }: {
    model: {
      canDisplayLabels: boolean
      rowHeight: number
      sources?: Source[]
    }
    labelWidth: number
    startIdx: number
    endIdx: number
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

    const visibleSources = sources?.slice(startIdx, endIdx)

    return visibleSources ? (
      <>
        {canDisplayLabels ? (
          <RectBg
            y={startIdx * rowHeight}
            x={0}
            width={legendWidth}
            height={(endIdx - startIdx + 0.25) * rowHeight}
          />
        ) : null}
        {visibleSources.map((source, i) => (
          <LegendItem
            key={`${source.name}-${startIdx + i}`}
            source={source}
            idx={startIdx + i}
            rowHeight={rowHeight}
          />
        ))}
        {canDisplayLabels
          ? visibleSources.map((source, i) => (
              <LegendItemText
                key={`${source.name}-text-${startIdx + i}`}
                source={source}
                idx={startIdx + i}
                rowHeight={rowHeight}
                textFillProps={textFillProps}
              />
            ))
          : null}
      </>
    ) : null
  },
)

export default MultiSampleVariantColorLegend
