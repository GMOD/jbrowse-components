import React from 'react'

import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { toLocale } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import type { ManhattanHit } from '../findManhattanHit.ts'

export interface TooltipModel {
  manhattanFeatureUnderMouse: ManhattanHit | undefined
}

const TooltipComponent = observer(function TooltipComponent({
  model,
  clientMouseCoord,
}: {
  model: TooltipModel
  clientMouseCoord: [number, number]
}) {
  const { manhattanFeatureUnderMouse } = model
  if (!manhattanFeatureUnderMouse) {
    return null
  }
  const { refName, start, score } = manhattanFeatureUnderMouse
  return (
    <BaseTooltip
      clientPoint={{ x: clientMouseCoord[0] + 10, y: clientMouseCoord[1] }}
    >
      <div>
        {refName}:{toLocale(start + 1)}
        <br />
        score: {score.toPrecision(4)}
      </div>
    </BaseTooltip>
  )
})

export default TooltipComponent
