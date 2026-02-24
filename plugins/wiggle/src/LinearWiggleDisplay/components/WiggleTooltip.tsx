import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { toLocale } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { toP } from '../../util.ts'

import type { WiggleDisplayModel } from './WebGLWiggleComponent.tsx'

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
          {summary && minScore != null && maxScore != null ? (
            <span>
              min:{toP(minScore)} avg:{toP(score)} max:{toP(maxScore)}
            </span>
          ) : (
            <span>{toP(score)}</span>
          )}
        </div>
      </BaseTooltip>
      <div
        style={{
          background: 'black',
          border: 'none',
          width: 1,
          height,
          top: 0,
          cursor: 'default',
          position: 'absolute',
          pointerEvents: 'none',
          left: offsetMouseCoord[0],
        }}
      />
    </>
  )
})

export default WiggleTooltip
