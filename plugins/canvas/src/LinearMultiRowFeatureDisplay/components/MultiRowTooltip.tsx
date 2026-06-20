import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { observer } from 'mobx-react'

import type { LinearMultiRowFeatureDisplayModel } from '../model.ts'

const MultiRowTooltip = observer(function MultiRowTooltip({
  model,
}: {
  model: LinearMultiRowFeatureDisplayModel
}) {
  const { hoveredFeature } = model
  return hoveredFeature ? (
    <BaseTooltip
      clientPoint={{ x: hoveredFeature.clientX, y: hoveredFeature.clientY }}
    >
      <div>{hoveredFeature.row}</div>
      {hoveredFeature.name ? <div>{hoveredFeature.name}</div> : null}
      <div>
        {hoveredFeature.refName}:{hoveredFeature.start + 1}..
        {hoveredFeature.end}
      </div>
    </BaseTooltip>
  ) : null
})

export default MultiRowTooltip
