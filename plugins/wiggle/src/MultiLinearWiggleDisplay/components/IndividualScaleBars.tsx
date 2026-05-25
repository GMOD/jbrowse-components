import { YScaleBar } from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

import ColorLegend from './ColorLegend.tsx'
import ScoreLegend from './ScoreLegend.tsx'

import type { WiggleDisplayModel } from '../model.ts'

const IndividualScaleBars = observer(function IndividualScaleBars({
  model,
  orientation,
  exportSVG,
}: {
  model: WiggleDisplayModel
  orientation?: 'left' | 'right'
  exportSVG?: boolean
}) {
  const {
    sources,
    rowHeight,
    rowHeightTooSmallForScalebar,
    needsCustomLegend,
    ticks,
    hierarchy,
    showTree,
  } = model

  // Skip ColorLegend when tree is showing - MultiWiggleLegendBar handles labels
  const treeIsShowing = hierarchy && showTree

  return sources?.length ? (
    <>
      {treeIsShowing ? null : (
        <ColorLegend
          exportSVG={exportSVG}
          model={model}
          rowHeight={model.rowHeight}
        />
      )}

      {rowHeightTooSmallForScalebar || needsCustomLegend ? (
        <ScoreLegend model={model} />
      ) : (
        sources.map((_source, idx) => (
          <g
            transform={`translate(0 ${rowHeight * idx})`}
            key={`${JSON.stringify(ticks)}-${idx}`}
          >
            <YScaleBar ticks={model.ticks} orientation={orientation} />
          </g>
        ))
      )}
    </>
  ) : null
})

export default IndividualScaleBars
