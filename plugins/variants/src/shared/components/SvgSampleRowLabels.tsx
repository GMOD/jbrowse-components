import { measureText, stripAlpha } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import RectBg from './RectBg.tsx'

import type { Source } from '../types.ts'
import type { SampleRowLabelsModel } from './types.ts'

const COLOR_BOX_WIDTH = 15
const LABEL_PADDING_PX = 10
const SWATCH_ONLY_WIDTH_PX = 20

// Width of the gutter's label column: the widest sample label at the given font
// size plus padding, or a fixed swatch width when rows are too short to letter.
export function getMaxLabelWidth({
  sources,
  fontSize,
  canDisplayLabels,
}: {
  sources: Source[] | undefined
  fontSize: number
  canDisplayLabels: boolean
}) {
  let maxWidth = 0
  if (sources) {
    for (const s of sources) {
      const width = canDisplayLabels
        ? measureText(s.label ?? s.name, fontSize) + LABEL_PADDING_PX
        : SWATCH_ONLY_WIDTH_PX
      if (width > maxWidth) {
        maxWidth = width
      }
    }
  }
  return maxWidth
}

const RowSwatch = function ({
  source,
  idx,
  rowHeight,
}: {
  source: Source
  idx: number
  rowHeight: number
}) {
  const { color } = source
  return color ? (
    <RectBg
      y={idx * rowHeight}
      x={0}
      width={COLOR_BOX_WIDTH + 0.5}
      height={rowHeight + 0.5}
      color={color}
    />
  ) : null
}

const RowLabel = function ({
  source,
  idx,
  rowHeight,
  fill,
}: {
  source: Source
  idx: number
  rowHeight: number
  fill: string
}) {
  const { color, name, label } = source
  const svgFontSize = Math.min(rowHeight, 12)
  return (
    <text
      y={(idx + 0.5) * rowHeight}
      x={color ? COLOR_BOX_WIDTH + 2 : 0}
      fontSize={svgFontSize}
      dominantBaseline="central"
      fill={fill}
    >
      {label ?? name}
    </text>
  )
}

// The rows of the left-hand sample gutter: a paper strip carrying one optional
// color swatch plus the sample name per row.
//
// NOT a color key — the key is `SvgVariantLegend` (export) / `FloatingLegend`
// (screen). This is tree-sidebar's `SvgRowLabels` job with a swatch column
// added, which is why the variant displays pass it as `SvgTreeSidebar`'s
// `labels` instead of taking the default: the default knows only `labelColor`
// and so dropped the swatch a "Color by → population" track is read through.
//
// Draws only rows `startIdx..endIdx` — the gutter virtualizes with the canvas
// (see SvgSampleRowLabelGutter), so a 3000-sample track emits a screenful of
// `<text>` rather than 3000.
const SvgSampleRowLabels = observer(function SvgSampleRowLabels({
  model,
  labelWidth,
  startIdx,
  endIdx,
}: {
  model: Pick<
    SampleRowLabelsModel,
    'canDisplayLabels' | 'effectiveRowHeight' | 'sources'
  >
  labelWidth: number
  startIdx: number
  endIdx: number
}) {
  const { canDisplayLabels, effectiveRowHeight: rowHeight, sources } = model
  const theme = useTheme()

  const hasColors = sources?.some(s => s.color) ?? false
  const gutterWidth = labelWidth + (hasColors ? COLOR_BOX_WIDTH + 5 : 0)

  const fill = stripAlpha(theme.palette.text.primary)

  const visibleSources = sources?.slice(startIdx, endIdx)

  return visibleSources ? (
    <>
      {canDisplayLabels ? (
        <RectBg
          y={startIdx * rowHeight}
          x={0}
          width={gutterWidth}
          height={(endIdx - startIdx + 0.25) * rowHeight}
        />
      ) : null}
      {visibleSources.map((source, i) => (
        <RowSwatch
          key={`${source.name}-${startIdx + i}`}
          source={source}
          idx={startIdx + i}
          rowHeight={rowHeight}
        />
      ))}
      {canDisplayLabels
        ? visibleSources.map((source, i) => (
            <RowLabel
              key={`${source.name}-text-${startIdx + i}`}
              source={source}
              idx={startIdx + i}
              rowHeight={rowHeight}
              fill={fill}
            />
          ))
        : null}
    </>
  ) : null
})

export default SvgSampleRowLabels
