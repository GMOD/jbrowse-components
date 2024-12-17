import { observer } from 'mobx-react'
import YScaleBar from '../../shared/YScaleBar'
import ColorLegend from './ColorLegend'
import ScoreLegend from './ScoreLegend'
import type { WiggleDisplayModel } from '../model'

const IndividualScaleBars = observer(function ({
  model,
  orientation,
  exportSVG,
  labelWidth,
}: {
  model: WiggleDisplayModel
  orientation?: string
  exportSVG?: boolean
  labelWidth: number
}) {
  const {
    sources,
    rowHeight,
    rowHeightTooSmallForScalebar,
    needsCustomLegend,
    ticks,
  } = model

  return (
    <>
      <ColorLegend
        exportSVG={exportSVG}
        model={model}
        rowHeight={model.rowHeight}
        labelWidth={labelWidth}
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
  )
})

export default IndividualScaleBars
