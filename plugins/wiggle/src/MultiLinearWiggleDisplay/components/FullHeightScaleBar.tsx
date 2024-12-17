import { observer } from 'mobx-react'
import YScaleBar from '../../shared/YScaleBar'
import ColorLegend from './ColorLegend'
import { getOffset } from './util'
import type { WiggleDisplayModel } from '../model'

const FullHeightScaleBar = observer(function ({
  model,
  orientation,
  exportSVG,
  viewWidth,
  labelWidth,
}: {
  model: WiggleDisplayModel
  orientation?: string
  exportSVG?: boolean
  viewWidth: number
  labelWidth: number
}) {
  return (
    <>
      <g transform={`translate(${!exportSVG ? getOffset(model) : 0},0)`}>
        <YScaleBar model={model} orientation={orientation} />
      </g>
      <g transform={`translate(${viewWidth - labelWidth - 100},0)`}>
        <ColorLegend
          exportSVG={exportSVG}
          model={model}
          rowHeight={12}
          labelWidth={labelWidth}
        />
      </g>
    </>
  )
})

export default FullHeightScaleBar
