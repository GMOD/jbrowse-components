import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import ColorLegend from './ColorLegend'
import { getOffset } from './util'
import YScaleBar from '../../shared/YScaleBar'

import type { WiggleDisplayModel } from '../model'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const FullHeightScaleBar = observer(function ({
  model,
  orientation,
  exportSVG,
}: {
  model: WiggleDisplayModel
  orientation?: string
  exportSVG?: boolean
}) {
  const { labelWidth } = model
  const { width: viewWidth } = getContainingView(model) as LinearGenomeViewModel
  return (
    <>
      <g transform={`translate(${!exportSVG ? getOffset(model) : 0},0)`}>
        <YScaleBar model={model} orientation={orientation} />
      </g>
      <g transform={`translate(${viewWidth - labelWidth - 100},0)`}>
        <ColorLegend exportSVG={exportSVG} model={model} rowHeight={12} />
      </g>
    </>
  )
})

export default FullHeightScaleBar
