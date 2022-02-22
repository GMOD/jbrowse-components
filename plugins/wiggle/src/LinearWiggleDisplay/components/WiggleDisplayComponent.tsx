import React from 'react'
import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'
import { WiggleDisplayModel } from '../models/model'
import YScaleBar from './YScaleBar'

const LinearWiggleDisplay = observer((props: { model: WiggleDisplayModel }) => {
  const { model } = props
  const { stats, height, needsScalebar } = model
  return (
    <div>
      <BaseLinearDisplayComponent {...props} />
      {stats && needsScalebar ? (
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 300,
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
