import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { toLocale } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import type { ManhattanHit } from '../findManhattanHit.ts'

export interface TooltipModel {
  manhattanHit: ManhattanHit | undefined
}

const TooltipComponent = observer(function TooltipComponent({
  model,
  clientMouseCoord,
}: {
  model: TooltipModel
  clientMouseCoord: [number, number]
}) {
  const { manhattanHit } = model
  return manhattanHit ? (
    <BaseTooltip
      clientPoint={{ x: clientMouseCoord[0] + 10, y: clientMouseCoord[1] }}
    >
      <div>
        {manhattanHit.refName}:{toLocale(manhattanHit.start + 1)}
        <br />
        score: {manhattanHit.score.toPrecision(4)}
      </div>
    </BaseTooltip>
  ) : null
})

export default TooltipComponent
