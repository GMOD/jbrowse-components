import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { toLocale } from '@jbrowse/core/util'
import { toP } from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

import type { ManhattanHit } from '../findManhattanHit.ts'
import type { MouseState } from '@jbrowse/core/ui'

export interface TooltipModel {
  featureUnderMouse: ManhattanHit | undefined
}

// SNPs/insertions span one bp (end === start + 1) and show a single 1-based
// coordinate; ranged structural variants show the full start..end interval.
function formatCoord({ start, end }: ManhattanHit) {
  return end - start > 1
    ? `${toLocale(start + 1)}..${toLocale(end)}`
    : toLocale(start + 1)
}

const TooltipComponent = observer(function TooltipComponent({
  model,
  mouseState,
}: {
  model: TooltipModel
  mouseState: MouseState | undefined
}) {
  const { featureUnderMouse } = model
  return featureUnderMouse && mouseState ? (
    <BaseTooltip
      clientPoint={{ x: mouseState.clientX, y: mouseState.clientY }}
    >
      <div>
        {featureUnderMouse.refName}:{formatCoord(featureUnderMouse)}
        <br />
        score: {toP(featureUnderMouse.score, 4)}
        {featureUnderMouse.r2 !== undefined ? (
          <>
            <br />
            r²: {toP(featureUnderMouse.r2, 3)}
          </>
        ) : null}
      </div>
    </BaseTooltip>
  ) : null
})

export default TooltipComponent
