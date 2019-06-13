import { getConf } from '@gmod/jbrowse-core/configuration'
import { BlockBasedTrack } from '@gmod/jbrowse-plugin-linear-genome-view'
import { observer } from 'mobx-react'
import React from 'react'
import { Axis, axisPropsFromTickScale, RIGHT } from 'react-d3-axis'
import { getScale } from '../../DensityRenderer/util'

const powersOfTen = []
for (let i = -20; i < 20; i += 1) {
  powersOfTen.push(10 ** i)
}

function WiggleTrackComponent(props) {
  const { model } = props
  const { domain, ready, height } = model

  const getYScaleBar = () => {
    const scaleType = getConf(model, 'scaleType')
    const scale = getScale({
      scaleType,
      domain,
      range: [height, 0],
      inverted: getConf(model, 'inverted'),
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
    <BlockBasedTrack {...props}>
      {ready && needsScalebar ? getYScaleBar(model) : null}
    </BlockBasedTrack>
  )
}
export default observer(WiggleTrackComponent)
