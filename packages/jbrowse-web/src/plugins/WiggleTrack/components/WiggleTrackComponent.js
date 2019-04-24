import React from 'react'
import { observer } from 'mobx-react'

import { Axis, axisPropsFromTickScale, RIGHT } from 'react-d3-axis'
import Track from '../../LinearGenomeView/components/Track'
import TrackBlocks from '../../LinearGenomeView/components/TrackBlocks'
import { readConfObject, getConf } from '../../../configuration'
import { getScale } from '../../WiggleRenderer/util'

const powersOfTen = []
for (let i = -20; i < 20; i += 1) {
  powersOfTen.push(10 ** i)
}

function WiggleTrackComponent(props) {
  const { model } = props
  const { domain, ready, height } = model

  const getRendererConf = (subtrack, slot) =>
    readConfObject(model.configuration.renderer, slot)

  const getYScaleBar = () => {
    const scaleType = getConf(model, 'scaleType')
    const scale = getScale({
      scaleType,
      inverted: getConf(model, 'inverted'),
      domain: [domain.min, domain.max],
      range: [height, 0],
      bounds: {
        min: getConf(model, 'minScore'),
        max: getConf(model, 'maxScore'),
      },
    })
    const axisProps = axisPropsFromTickScale(scale, 4)
    const values =
      scaleType === 'log'
        ? axisProps.values.filter(s => powersOfTen.includes(s))
        : axisProps.values
    return (
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 300,
          pointerEvents: 'none',
          zIndex: 100,
          width: 35,
          height,
        }}
      >
        <svg style={{ height }}>
          <Axis
            {...axisProps}
            values={values}
            format={n => n}
            style={{ orient: RIGHT }}
          />
        </svg>
      </div>
    )
  }

  const needsScalebar = model.rendererTypeName === 'XYPlotRenderer'

  return (
    <Track {...props}>
      <TrackBlocks {...props} blockState={model.blockState} />
      {ready && needsScalebar ? getYScaleBar(model) : null}
    </Track>
  )
}
export default observer(WiggleTrackComponent)
