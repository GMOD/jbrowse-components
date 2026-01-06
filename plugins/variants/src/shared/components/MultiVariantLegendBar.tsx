import { useMemo } from 'react'

import { measureText } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import ColorLegend from './MultiVariantColorLegend.tsx'
import MultiVariantLegendBarWrapper from './MultiVariantLegendBarWrapper.tsx'

import type { LegendBarModel } from './types.ts'

const MultiVariantLegendBar = observer(function MultiVariantLegendBar(props: {
  model: LegendBarModel
  orientation?: string
  exportSVG?: boolean
}) {
  const { model } = props
  const { canDisplayLabels, rowHeight, sources } = model
  const svgFontSize = Math.min(rowHeight, 12)

  const labelWidth = useMemo(() => {
    if (!sources) {
      return 0
    }
    let maxWidth = 0
    for (const s of sources) {
      const width = canDisplayLabels
        ? measureText(s.label, svgFontSize) + 10
        : 20
      if (width > maxWidth) {
        maxWidth = width
      }
    }
    return maxWidth
  }, [sources, svgFontSize, canDisplayLabels])

  return sources ? (
    <MultiVariantLegendBarWrapper {...props}>
      <ColorLegend model={model} labelWidth={labelWidth} />
    </MultiVariantLegendBarWrapper>
  ) : null
})

export default MultiVariantLegendBar
