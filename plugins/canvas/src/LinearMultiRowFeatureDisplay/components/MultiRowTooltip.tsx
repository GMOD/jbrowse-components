import { SanitizedHTML } from '@jbrowse/core/ui'
import HoverTooltip from '@jbrowse/core/ui/HoverTooltip'
import { assembleLocString } from '@jbrowse/core/util'
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
  // the row's label comes from the live row order, never from a copy taken when
  // the hover happened — see `hoveredRow`
  const { hoveredFeature, hoveredRow } = model
  return (
    <HoverTooltip hit={hoveredFeature} mouseState={mouseState}>
      {hoveredRow ? <div>{hoveredRow.label ?? hoveredRow.name}</div> : null}
      {hoveredFeature?.name ? (
        <div>
          <SanitizedHTML html={hoveredFeature.name} />
        </div>
      ) : null}
      {hoveredFeature ? <div>{assembleLocString(hoveredFeature)}</div> : null}
    </HoverTooltip>
  )
})

export default MultiRowTooltip
