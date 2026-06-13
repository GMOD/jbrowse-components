import { observer } from 'mobx-react'

import ColorLegend from './MultiSampleVariantColorLegend.tsx'
import { getMaxLabelWidth } from '../variantLegend.ts'

import type { LegendBarModel } from './types.ts'

const MultiSampleVariantLegendBar = observer(
  function MultiSampleVariantLegendBar({ model }: { model: LegendBarModel }) {
    const {
      id,
      scrollTop,
      height,
      canDisplayLabels,
      rowHeight,
      sources,
      showLegend,
    } = model
    const svgFontSize = Math.min(rowHeight, 12)
    const clipid = `legend-${typeof jest === 'undefined' ? id : 'test'}`

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

    return sources && showLegend ? (
      <>
        <defs>
          <clipPath id={clipid}>
            <rect x={0} y={0} width={1000} height={height} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipid})`}>
          <g transform={`translate(0,${-scrollTop})`}>
            <ColorLegend
              model={model}
              labelWidth={labelWidth}
              startIdx={startIdx}
              endIdx={endIdx}
            />
          </g>
        </g>
      </>
    ) : null
  },
)

export default MultiSampleVariantLegendBar
