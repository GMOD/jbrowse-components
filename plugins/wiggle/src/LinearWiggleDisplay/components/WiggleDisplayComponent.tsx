import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'
import React from 'react'
import { Axis, LEFT, RIGHT } from 'react-d3-axis'
import { WiggleDisplayModel } from '../models/model'

export const YScaleBar = observer(
  ({
    model,
    orientation,
  }: {
    model: WiggleDisplayModel
    orientation?: string
  }) => {
    const { ticks } = model

    return (
      <Axis
        {...ticks}
        format={(n: number) => n}
        style={{ orient: orientation === 'left' ? LEFT : RIGHT }}
      />
    )
  },
)

const LinearWiggleDisplay = observer((props: { model: WiggleDisplayModel }) => {
  const { model } = props
  const { ready, stats, height, needsScalebar } = model
  return (
    <div>
      <BaseLinearDisplayComponent {...props} />
      {ready && stats && needsScalebar ? (
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
