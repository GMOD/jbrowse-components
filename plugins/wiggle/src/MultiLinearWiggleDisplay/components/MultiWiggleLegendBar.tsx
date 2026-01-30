import { useMemo } from 'react'

import { measureText } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import MultiWiggleColorLegend from './MultiWiggleColorLegend.tsx'
import MultiWiggleLegendBarWrapper from './MultiWiggleLegendBarWrapper.tsx'

import type { LegendBarModel } from './treeTypes.ts'

const MultiWiggleLegendBar = observer(function MultiWiggleLegendBar(props: {
  model: LegendBarModel
  orientation?: string
  exportSVG?: boolean
}) {
  const { model } = props
  const { canDisplayLegendLabels, rowHeight, sources } = model
  const svgFontSize = Math.min(rowHeight, 12)

  const labelWidth = useMemo(() => {
    if (!sources) {
      return 0
    }
    let maxWidth = 0
    for (const s of sources) {
      const width = canDisplayLegendLabels
        ? measureText(s.name, svgFontSize) + 10
        : 20
      if (width > maxWidth) {
        maxWidth = width
      }
    }
    return maxWidth
  }, [sources, svgFontSize, canDisplayLegendLabels])

  return sources ? (
    <MultiWiggleLegendBarWrapper {...props}>
      <MultiWiggleColorLegend model={model} labelWidth={labelWidth} />
    </MultiWiggleLegendBarWrapper>
  ) : null
})

export default MultiWiggleLegendBar
