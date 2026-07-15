import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { toLocale } from '@jbrowse/core/util'
import { toP } from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

import type { ManhattanHit } from '../findManhattanHit.ts'

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
  clientMouseCoord,
}: {
  model: TooltipModel
  clientMouseCoord: [number, number]
}) {
  const { featureUnderMouse } = model
  return featureUnderMouse ? (
    <BaseTooltip
      clientPoint={{ x: clientMouseCoord[0] + 10, y: clientMouseCoord[1] }}
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
