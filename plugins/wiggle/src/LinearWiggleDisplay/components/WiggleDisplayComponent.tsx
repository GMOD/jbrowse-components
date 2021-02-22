import { getConf } from '@jbrowse/core/configuration'
import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'
import React from 'react'
import { Axis, axisPropsFromTickScale, RIGHT } from 'react-d3-axis'
import { getScale } from '../../util'
import { WiggleDisplayModel, YSCALEBAR_LABEL_OFFSET } from '../models/model'

export const YScaleBar = observer(
  ({ model }: { model: WiggleDisplayModel }) => {
    const { domain, height, scaleType } = model
    const range = [height - YSCALEBAR_LABEL_OFFSET, YSCALEBAR_LABEL_OFFSET]
    const scale = getScale({
      scaleType,
      domain,
      range,
      inverted: getConf(model, 'inverted'),
    })
    const ticks = height < 50 ? 2 : 4
    const axisProps = axisPropsFromTickScale(scale, ticks)
    const { values } = axisProps

    return (
      <Axis
        {...axisProps}
        values={values}
        format={(n: number) => n}
        style={{ orient: RIGHT }}
      />
    )
  },
)

export default observer((props: { model: WiggleDisplayModel }) => {
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
