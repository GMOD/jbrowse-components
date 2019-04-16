import React from 'react'
import { observer } from 'mobx-react'

import { Axis, axisPropsFromTickScale, RIGHT } from 'react-d3-axis'
import Track from '../../LinearGenomeView/components/Track'
import TrackBlocks from '../../LinearGenomeView/components/TrackBlocks'
import { readConfObject, getConf, getConfs } from '../../../configuration'
import { getScale } from '../../WiggleRenderer/util'

function pickN(a, n) {
  const p = Math.floor(a.length / n) || 1
  return a.slice(0, p * n).filter((_, i) => i % p === 0)
}
function WiggleTrackComponent(props) {
  const { model } = props
  const { stats, ready, error, height } = model

  if (error)
    return (
      <Track {...props}>
        <div
          className="blur"
          style={{ backgroundColor: 'white', color: 'red' }}
        >
          {`${error}`}
        </div>
      </Track>
    )

  if (!ready)
    return (
      <Track {...props}>
        <div className="blur" style={{ backgroundColor: 'white' }}>
          Loading stats
        </div>
      </Track>
    )
  const { min, max } = stats
  const [maxScore, minScore] = getConfs(model, ['maxScore', 'minScore'])
  console.log(min, max, minScore, maxScore)
  const getRendererConf = (subtrack, slot) =>
    readConfObject(model.configuration.renderer, slot)

  const getYScaleBar = trackModel => {
    const scaleType = getRendererConf(trackModel, 'scaleType')
    const inverted = getRendererConf(trackModel, 'inverted')
    const opts = { minScore, maxScore, inverted }

    const scale = getScale(scaleType, [min, max], [height, 0], opts)
    const axisProps = axisPropsFromTickScale(scale, 3)
    // const values = pickN(axisProps.values, 4)
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
        <svg style={{ height, textShadow: '1px 1px #ccc' }}>
          <Axis
            {...axisProps}
            //       values={values}
            format={n => n}
            style={{ orient: RIGHT }}
          />
        </svg>
      </div>
    )
  }

  const needsScalebar = getRendererConf(model, 'renderType') === 'xyplot'

  // {needsScalebar ? getYScaleBar(model) : null}
  return (
    <Track {...props}>
      <TrackBlocks {...props} blockState={model.blockState} />
      <div style={{ position: 'relative', height }}>
        {needsScalebar ? getYScaleBar(model) : null}
      </div>
    </Track>
  )
}
export default observer(WiggleTrackComponent)
