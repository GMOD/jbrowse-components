import React from 'react'
import { observer } from 'mobx-react'

import { Axis, axisPropsFromTickScale, RIGHT } from 'react-d3-axis'
import Track from '../../LinearGenomeView/components/Track'
import TrackBlocks from '../../LinearGenomeView/components/TrackBlocks'
import { readConfObject, getConf, getConfs } from '../../../configuration'
import { getScale } from '../../WiggleRenderer/util'

function makeFilterFunc(howMany) {
  return function filterFunc(elt, idx, arr) {
    return (
      idx === 0 || // first element
      idx === arr.length - 1 || // last element
      idx % Math.floor(arr.length / howMany) === 0
    )
  }
}
function WiggleTrackComponent(props) {
  const { model } = props
  const { stats, ready, height } = model

  const getRendererConf = (subtrack, slot) =>
    readConfObject(model.configuration.renderer, slot)

  const scaleType = getConf(model, 'scaleType')
  const inverted = getConf(model, 'inverted')
  const getYScaleBar = () => {
    const { min, max } = stats
    const [maxScore, minScore] = getConfs(model, ['maxScore', 'minScore'])
    const opts = { minScore, maxScore, inverted }
    const scale = getScale(scaleType, [min, max], [height, 0], opts)
    const axisProps = axisPropsFromTickScale(scale, 5)
    // const values = axisProps.values.filter(makeFilterFunc(3))
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
          <Axis {...axisProps} format={n => n} style={{ orient: RIGHT }} />
        </svg>
      </div>
    )
  }

  const needsScalebar = getRendererConf(model, 'renderType') === 'xyplot'

  return (
    <Track {...props}>
      <TrackBlocks {...props} blockState={model.blockState} />
      {ready && needsScalebar ? getYScaleBar(model) : null}
    </Track>
  )
}
export default observer(WiggleTrackComponent)
