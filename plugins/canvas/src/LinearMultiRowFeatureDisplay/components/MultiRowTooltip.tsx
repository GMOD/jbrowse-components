import { SanitizedHTML } from '@jbrowse/core/ui'
import HoverTooltip from '@jbrowse/core/ui/HoverTooltip'
import { assembleLocString } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import type { LinearMultiRowFeatureDisplayModel } from '../model.ts'
import type { MouseState } from '@jbrowse/core/ui'

export function indelMagnitude(delta: number | undefined) {
  return delta === undefined || delta === 0
    ? undefined
    : `${delta > 0 ? '+' : '-'}${Math.abs(delta).toLocaleString()} bp`
}

const MultiRowTooltip = observer(function MultiRowTooltip({
  model,
  mouseState,
}: {
  model: LinearMultiRowFeatureDisplayModel
  mouseState: MouseState
}) {
  const { hoveredFeature, hoveredRow } = model
  const magnitude = indelMagnitude(hoveredFeature?.delta)
  return (
    <HoverTooltip hit={hoveredFeature} mouseState={mouseState}>
      {hoveredRow ? <div>{hoveredRow.label ?? hoveredRow.name}</div> : null}
      {hoveredFeature?.name ? (
        <div>
          <SanitizedHTML html={hoveredFeature.name} />
        </div>
      ) : null}
      {hoveredFeature ? <div>{assembleLocString(hoveredFeature)}</div> : null}
      {/* the block's width is reference span, so an insertion of any size
          draws the same */}
      {magnitude ? <div>{magnitude}</div> : null}
    </HoverTooltip>
  )
})

export default MultiRowTooltip
