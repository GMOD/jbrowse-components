import { SanitizedHTML } from '@jbrowse/core/ui'
import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { observer } from 'mobx-react'

import type { LinearMultiRowFeatureDisplayModel } from '../model.ts'
import type { MouseState } from '@jbrowse/core/ui'

const MultiRowTooltip = observer(function MultiRowTooltip({
  model,
  mouseState,
}: {
  model: LinearMultiRowFeatureDisplayModel
  mouseState: MouseState
}) {
  const { hoveredFeature, sources } = model
  // the row's label comes from the live row order, never from a copy taken when
  // the hover happened
  const row = hoveredFeature ? sources[hoveredFeature.rowIndex] : undefined
  return hoveredFeature ? (
    <BaseTooltip clientPoint={{ x: mouseState.clientX, y: mouseState.clientY }}>
      {row ? <div>{row.label ?? row.name}</div> : null}
      {hoveredFeature.name ? (
        <div>
          <SanitizedHTML html={hoveredFeature.name} />
        </div>
      ) : null}
      <div>
        {hoveredFeature.refName}:{hoveredFeature.start + 1}..
        {hoveredFeature.end}
      </div>
    </BaseTooltip>
  ) : null
})

export default MultiRowTooltip
