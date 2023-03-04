import React from 'react'
import { observer } from 'mobx-react'
import {
  measureText,
  getContainingView,
  getContainingTrack,
} from '@jbrowse/core/util'
import { getConf } from '@jbrowse/core/configuration'
import {
  BaseLinearDisplayComponent,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

// locals
import { WiggleDisplayModel } from '../models/model'
import YScaleBar from '../../shared/YScaleBar'

type LGV = LinearGenomeViewModel

const LinearWiggleDisplay = observer((props: { model: WiggleDisplayModel }) => {
  const { model } = props
  const { stats, height, needsScalebar } = model

  const { trackLabels } = getContainingView(model) as LGV
  const track = getContainingTrack(model)
  const left =
    trackLabels === 'overlapping'
      ? measureText(getConf(track, 'name'), 12.8) + 100
      : 50
  return (
    <div>
      <BaseLinearDisplayComponent {...props} />
      {stats && needsScalebar ? (
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left,
            pointerEvents: 'none',
            height,
            width: 50,
          }}
        >
          <YScaleBar model={model} />
        </svg>
      ) : null}
    </div>
  )
})

export default LinearWiggleDisplay

export { default as YScaleBar } from '../../shared/YScaleBar'
