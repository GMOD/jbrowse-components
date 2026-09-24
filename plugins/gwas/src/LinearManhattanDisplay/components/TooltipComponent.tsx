import HoverTooltip from '@jbrowse/core/ui/HoverTooltip'
import { assembleLocString } from '@jbrowse/core/util'
import { toP } from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

import type { ManhattanHit } from '../findManhattanHit.ts'
import type { MouseState } from '@jbrowse/core/ui'

export interface TooltipModel {
  hoveredFeature: ManhattanHit | undefined
}

const TooltipComponent = observer(function TooltipComponent({
  model,
  mouseState,
}: {
  model: TooltipModel
  mouseState: MouseState | undefined
}) {
  const { hoveredFeature } = model
  return (
    <HoverTooltip hit={hoveredFeature} mouseState={mouseState}>
      {hoveredFeature ? (
        <div>
          {assembleLocString(hoveredFeature)}
          <br />
          score: {toP(hoveredFeature.score, 4)}
        </div>
      ) : null}
    </HoverTooltip>
  )
})

export default TooltipComponent
