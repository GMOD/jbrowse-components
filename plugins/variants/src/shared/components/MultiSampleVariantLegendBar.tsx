import { useMemo } from 'react'

import { measureText } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import ColorLegend from './MultiSampleVariantColorLegend.tsx'

import type { LegendBarModel } from './types.ts'

const MultiSampleVariantLegendBar = observer(
  function MultiSampleVariantLegendBar(props: {
    model: LegendBarModel
    orientation?: string
    exportSVG?: boolean
  }) {
    const { model } = props
    const { id, scrollTop, height, canDisplayLabels, rowHeight, sources } =
      model
    const svgFontSize = Math.min(rowHeight, 12)
    const clipid = `legend-${typeof jest === 'undefined' ? id : 'test'}`

    const labelWidth = useMemo(() => {
      if (!sources) {
        return 0
      }
      let maxWidth = 0
      for (const s of sources) {
        const width = canDisplayLabels
          ? measureText(s.name, svgFontSize) + 10
          : 20
        if (width > maxWidth) {
          maxWidth = width
        }
      }
      return maxWidth
    }, [sources, svgFontSize, canDisplayLabels])

    return sources ? (
      <>
        <defs>
          <clipPath id={clipid}>
            <rect x={0} y={0} width={1000} height={height} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipid})`}>
          <g transform={`translate(0,${-scrollTop})`}>
            <ColorLegend model={model} labelWidth={labelWidth} />
          </g>
        </g>
      </>
    ) : null
  },
)

export default MultiSampleVariantLegendBar
