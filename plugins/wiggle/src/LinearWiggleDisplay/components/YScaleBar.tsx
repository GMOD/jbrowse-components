import React from 'react'
import { observer } from 'mobx-react'
import { Axis, LEFT, RIGHT } from 'react-d3-axis'
import { WiggleDisplayModel } from '../models/model'

const YScaleBar = observer(
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
export default YScaleBar
