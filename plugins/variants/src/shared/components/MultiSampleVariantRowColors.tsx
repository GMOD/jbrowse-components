import { SvgClipRect } from '@jbrowse/core/svg/SvgExport'
import { observer } from 'mobx-react'

import ColorLegend from './MultiSampleVariantColorLegend.tsx'
import { getMaxLabelWidth } from '../variantLegend.ts'

import type { RowColorsModel } from './types.ts'

const MultiSampleVariantRowColors = observer(
  function MultiSampleVariantRowColors({ model }: { model: RowColorsModel }) {
    const {
      id,
      scrollTop,
      height,
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
      <SvgClipRect id={`row-colors-${id}`} width={1000} height={height}>
        <g transform={`translate(0,${-scrollTop})`}>
          <ColorLegend
            model={model}
            labelWidth={labelWidth}
            startIdx={startIdx}
            endIdx={endIdx}
          />
        </g>
      </SvgClipRect>
    ) : null
  },
)

export default MultiSampleVariantRowColors
