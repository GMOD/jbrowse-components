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

const LinearWiggleDisplay = observer((props: { model: WiggleDisplayModel }) => {
  const { model } = props
  const { stats, height, needsScalebar } = model

  //@ts-ignore
  const { trackLabels } = getContainingView(model)
  const left =
    trackLabels === 'overlapping'
      ? measureText(getConf(getContainingTrack(model), 'name')) + 160
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

export { YScaleBar }
