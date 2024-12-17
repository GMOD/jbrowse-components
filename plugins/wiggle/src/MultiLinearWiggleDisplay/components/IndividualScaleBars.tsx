import { observer } from 'mobx-react'

import ColorLegend from './ColorLegend'
import ScoreLegend from './ScoreLegend'
import YScaleBar from '../../shared/YScaleBar'

import type { WiggleDisplayModel } from '../model'

const IndividualScaleBars = observer(function ({
  model,
  orientation,
  exportSVG,
}: {
  model: WiggleDisplayModel
  orientation?: string
  exportSVG?: boolean
}) {
  const {
    sources,
    rowHeight,
    rowHeightTooSmallForScalebar,
    needsCustomLegend,
    ticks,
  } = model

  return sources?.length ? (
    <>
      <ColorLegend
        exportSVG={exportSVG}
        model={model}
        rowHeight={model.rowHeight}
      />

      {rowHeightTooSmallForScalebar || needsCustomLegend ? (
        <ScoreLegend model={model} />
      ) : (
        sources.map((_source, idx) => (
          <g
            transform={`translate(0 ${rowHeight * idx})`}
            key={`${JSON.stringify(ticks)}-${idx}`}
          >
            <YScaleBar model={model} orientation={orientation} />
          </g>
        ))
      )}
    </>
  ) : null
})

export default IndividualScaleBars
