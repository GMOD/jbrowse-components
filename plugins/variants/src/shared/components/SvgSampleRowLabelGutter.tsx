import { SvgClipRect } from '@jbrowse/core/svg/SvgExport'
import { observer } from 'mobx-react'

import SvgSampleRowLabels, { getMaxLabelWidth } from './SvgSampleRowLabels.tsx'

import type { SampleRowLabelsModel } from './types.ts'

// The scrolled, clipped viewport around the sample gutter: measures the label
// column, works out which rows the current scrollTop exposes, and offsets them.
// Rendered by both the on-screen overlay and the SVG export, so the two can't
// virtualize differently.
const SvgSampleRowLabelGutter = observer(function SvgSampleRowLabelGutter({
  model,
}: {
  model: SampleRowLabelsModel
}) {
  const {
    id,
    scrollTop,
    availableHeight: height,
    canDisplayLabels,
    effectiveRowHeight: rowHeight,
    sources,
  } = model
  const svgFontSize = Math.min(rowHeight, 12)

  const labelWidth = getMaxLabelWidth({
    sources,
    fontSize: svgFontSize,
    canDisplayLabels,
  })

  const nrow = sources?.length ?? 0
  const startIdx =
    rowHeight > 0 ? Math.max(0, Math.floor(scrollTop / rowHeight)) : 0
  const endIdx =
    rowHeight > 0
      ? Math.min(nrow, Math.ceil((scrollTop + height) / rowHeight))
      : 0

  // Clip id scoped by model.id so two overlays in one exported document don't
  // collide (a duplicate clipPath id makes the second render unclipped). Uses
  // the same real id in tests as in production — the export duplicate-id guard
  // runs under jest, so a hardcoded test literal would defeat itself.
  return sources ? (
    <SvgClipRect id={`sample-row-labels-${id}`} width={1000} height={height}>
      <g transform={`translate(0,${-scrollTop})`}>
        <SvgSampleRowLabels
          model={model}
          labelWidth={labelWidth}
          startIdx={startIdx}
          endIdx={endIdx}
        />
      </g>
    </SvgClipRect>
  ) : null
})

export default SvgSampleRowLabelGutter
