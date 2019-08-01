import { getConf } from '@gmod/jbrowse-core/configuration'
import { BlockBasedTrack } from '@gmod/jbrowse-plugin-linear-genome-view'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import React from 'react'
import { Axis, axisPropsFromTickScale, RIGHT } from 'react-d3-axis'
import { getScale } from '../../util'

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
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 300,
          width: 35,
          height: '100%',
        }}
      >
        <Axis
          {...axisProps}
          values={values}
          format={n => n}
          style={{ orient: RIGHT }}
        />
      </svg>
    )
  }

  const needsScalebar =
    model.rendererTypeName === 'XYPlotRenderer' ||
    model.rendererTypeName === 'LinePlotRenderer'

  return (
    <BlockBasedTrack {...props}>
      {ready && needsScalebar ? getYScaleBar(model) : null}
    </BlockBasedTrack>
  )
}

WiggleTrackComponent.propTypes = {
  model: MobxPropTypes.observableObject.isRequired,
}

export default observer(WiggleTrackComponent)
