import { getConf } from '@jbrowse/core/configuration'
import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import React from 'react'
import { Axis, axisPropsFromTickScale, RIGHT } from 'react-d3-axis'
import { getScale } from '../../util'
import { WiggleDisplayModel } from '../models/model'

const powersOfTen: number[] = []
for (let i = -20; i < 20; i += 1) {
  powersOfTen.push(10 ** i)
}

export const YScaleBar = observer(
  ({ model }: { model: WiggleDisplayModel }) => {
    const { domain, height } = model
    const scaleType = getConf(model, 'scaleType')
    const scale = getScale({
      scaleType,
      domain,
      range: [height, 0],
      inverted: getConf(model, 'inverted'),
    })
    const ticks = height < 50 ? 2 : 4
    const axisProps = axisPropsFromTickScale(scale, ticks)
    const values =
      scaleType === 'log'
        ? axisProps.values.filter((s: number) => powersOfTen.includes(s))
        : axisProps.values

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

function WiggleDisplayComponent(props: { model: WiggleDisplayModel }) {
  const { model } = props
  const { ready, stats, needsScalebar } = model
  return (
    <BaseLinearDisplayComponent {...props}>
      {ready && stats && needsScalebar ? <YScaleBar model={model} /> : null}
    </BaseLinearDisplayComponent>
  )
}

WiggleDisplayComponent.propTypes = {
  model: MobxPropTypes.observableObject.isRequired,
}

export default observer(WiggleDisplayComponent)
