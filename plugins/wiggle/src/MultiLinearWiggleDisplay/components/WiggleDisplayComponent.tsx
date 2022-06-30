import React from 'react'
import {
  measureText,
  getContainingView,
  getContainingTrack,
} from '@jbrowse/core/util'
import { getConf } from '@jbrowse/core/configuration'
import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'
import { WiggleDisplayModel } from '../models/model'
import YScaleBar from './YScaleBar'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const LinearWiggleDisplay = observer((props: { model: WiggleDisplayModel }) => {
  const { model } = props
  const { stats, height, needsScalebar, needsScaleSmall, numSources, ticks } =
    model
  const { trackLabels } = getContainingView(model) as LGV
  const track = getContainingTrack(model)
  const left =
    trackLabels === 'overlapping'
      ? measureText(getConf(track, 'name'), 12.8) + 100
      : 10
  return (
    <div>
      <BaseLinearDisplayComponent {...props} />
      {stats ? (
        <>
          {needsScalebar ? (
            <svg
              style={{
                position: 'absolute',
                top: 0,
                left,
                pointerEvents: 'none',
                height,
                width: 200,
              }}
            >
              <YScaleBar model={model} />
            </svg>
          ) : null}

          {needsScaleSmall && numSources ? (
            <svg
              style={{
                position: 'absolute',
                top: 0,
                left,
                pointerEvents: 'none',
                height,
                width: 200,
              }}
            >
              {new Array(numSources).fill(0).map((_, idx) => (
                <text
                  key={JSON.stringify(ticks) + '-' + idx}
                  y={(idx * height) / numSources + 12}
                  x={0}
                >
                  [{ticks.values[0]}-{ticks.values[1]}]
                </text>
              ))}
            </svg>
          ) : null}
        </>
      ) : null}
    </div>
  )
})

export default LinearWiggleDisplay

export { YScaleBar }
