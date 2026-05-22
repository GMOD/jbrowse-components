import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { toLocale } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import type { ManhattanHit } from '../findManhattanHit.ts'

export interface TooltipModel {
  featureUnderMouse: ManhattanHit | undefined
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
        {featureUnderMouse.refName}:{toLocale(featureUnderMouse.start + 1)}
        <br />
        score: {featureUnderMouse.score.toPrecision(4)}
      </div>
    </BaseTooltip>
  ) : null
})

export default TooltipComponent
