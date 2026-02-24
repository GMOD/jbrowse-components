import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { toLocale } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { toP } from '../../util.ts'

import type { MultiWiggleDisplayModel } from './WebGLMultiWiggleComponent.tsx'

type Coord = [number, number]

const MultiWiggleTooltip = observer(function MultiWiggleTooltip({
  model,
  clientMouseCoord,
  offsetMouseCoord,
  height,
}: {
  model: MultiWiggleDisplayModel
  clientMouseCoord: Coord
  offsetMouseCoord: Coord
  height: number
}) {
  const { featureUnderMouse } = model
  if (!featureUnderMouse) {
    return null
  }
  const { refName, start, end, score, minScore, maxScore, source, summary } =
    featureUnderMouse
  const coord =
    start === end ? toLocale(start) : `${toLocale(start)}..${toLocale(end)}`
  const sourceObj = model.sources.find(s => s.name === source)

  return (
    <>
      <BaseTooltip
        clientPoint={{ x: clientMouseCoord[0] + 5, y: clientMouseCoord[1] }}
      >
        <div>
          {[refName, coord].filter(f => !!f).join(':')}
          <br />
          <span
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            {sourceObj?.color ? (
              <span
                style={{
                  width: 10,
                  height: 10,
                  background: sourceObj.color,
                  display: 'inline-block',
                }}
              />
            ) : null}
            {source}
          </span>
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

export default MultiWiggleTooltip
