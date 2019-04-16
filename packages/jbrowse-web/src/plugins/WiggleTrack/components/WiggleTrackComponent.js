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

  if (error) {
    return <div className="blur">{error}</div>
  }
  if (!ready) {
    return <div className="blur">Loading stats</div>
  }

  const { min, max } = stats
  const [maxScore, minScore, defaultHeight] = getConfs(model, [
    'maxScore',
    'minScore',
    'defaultHeight',
  ])
  const getRendererConf = (subtrack, slot) =>
    readConfObject(model.configuration.renderer, slot)

  const getYScaleBar = subtrack => {
    const scaleType = getRendererConf(subtrack, 'scaleType')
    const inverted = getRendererConf(subtrack, 'inverted')
    const opts = { minScore, maxScore, inverted }
    const scale = getScale(scaleType, [min, max], [defaultHeight, 0], opts)
    const axisProps = axisPropsFromTickScale(scale, 3)
    const values = pickN(axisProps.values, 4)
    return (
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 300,
          pointerEvents: 'none',
          zIndex: 100,
          width: 35,
        }}
      >
        <svg style={{ textShadow: '1px 1px #ccc' }}>
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

  const needsScalebar = getConf(model, 'renderType') === 'xyplot'

  // <div style={{ position: 'relative', height }}>
  // {needsScalebar ? getYScaleBar(model) : null}
  return (
    <Track {...props}>
      <TrackBlocks {...props} blockState={model.blockState} />
    </Track>
  )
}
export default observer(WiggleTrackComponent)
