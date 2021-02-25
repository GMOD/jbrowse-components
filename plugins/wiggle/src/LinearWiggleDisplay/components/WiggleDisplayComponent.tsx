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
    const scale = getScale({
      scaleType,
      domain,
      range: [height - YSCALEBAR_LABEL_OFFSET, YSCALEBAR_LABEL_OFFSET],
      inverted: getConf(model, 'inverted'),
    })
    const ticks = height < 50 ? 2 : 4
    const axisProps = axisPropsFromTickScale(scale, ticks)
    const { values } = axisProps

    return (
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
        <g transform="translate(0,5)" />
        <Axis
          {...axisProps}
          values={values}
          format={(n: number) => n}
          style={{ orient: RIGHT }}
        />
      </svg>
    )
  },
)

export default observer((props: { model: WiggleDisplayModel }) => {
  const { model } = props
  const { ready, stats, needsScalebar } = model
  return (
    <div>
      <BaseLinearDisplayComponent {...props} />
      <div
        style={{
          paddingTop: needsScalebar ? YSCALEBAR_LABEL_OFFSET : undefined,
          paddingBottom: needsScalebar ? YSCALEBAR_LABEL_OFFSET : undefined,
        }}
      >
        {ready && stats && needsScalebar ? <YScaleBar model={model} /> : null}
      </div>
    </div>
  )
})
