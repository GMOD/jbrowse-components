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
          {/* assembleLocString collapses a one-bp SNP to a single 1-based
              coordinate rather than printing "101..101", and localizes the
              numbers — this used to be a local formatCoord doing both by hand */}
          {assembleLocString(hoveredFeature)}
          <br />
          score: {toP(hoveredFeature.score, 4)}
          {hoveredFeature.r2 === undefined ? null : (
            <>
              <br />r{'\u00B2'}: {toP(hoveredFeature.r2, 3)}
            </>
          )}
        </div>
      ) : null}
    </HoverTooltip>
  )
})

export default TooltipComponent
