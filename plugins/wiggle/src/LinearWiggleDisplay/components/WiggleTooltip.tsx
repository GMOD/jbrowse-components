import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { toLocale } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import {
  WiggleCursorLine,
  WiggleScoreDisplay,
} from '../../shared/WiggleTooltipShared.tsx'

import type { WiggleDisplayModel } from './WiggleComponent.tsx'

type Coord = [number, number]

const WiggleTooltip = observer(function WiggleTooltip({
  model,
  clientMouseCoord,
  offsetMouseCoord,
  height,
}: {
  model: WiggleDisplayModel
  clientMouseCoord: Coord
  offsetMouseCoord: Coord
  height: number
}) {
  const { featureUnderMouse } = model
  if (!featureUnderMouse) {
    return null
  }
  const { refName, start, end, score, minScore, maxScore, summary } =
    featureUnderMouse
  const coord =
    start === end ? toLocale(start) : `${toLocale(start)}..${toLocale(end)}`

  return (
    <>
      <BaseTooltip
        clientPoint={{ x: clientMouseCoord[0] + 5, y: clientMouseCoord[1] }}
      >
        <div>
          {[refName, coord].filter(f => !!f).join(':')}
          <br />
          <WiggleScoreDisplay
            score={score}
            summary={summary}
            minScore={minScore}
            maxScore={maxScore}
          />
        </div>
      </BaseTooltip>
      <WiggleCursorLine height={height} left={offsetMouseCoord[0]} />
    </>
  )
})

export default WiggleTooltip
