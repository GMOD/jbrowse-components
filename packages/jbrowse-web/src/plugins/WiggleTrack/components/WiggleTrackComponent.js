import React from 'react'
import { observer } from 'mobx-react'

import { Axis, axisPropsFromTickScale, RIGHT } from 'react-d3-axis'
import Track from '../../LinearGenomeView/components/Track'
import { readConfObject, getConfs } from '../../../configuration'
import { getScale } from '../../WiggleRenderer/util'

function pickN(a, n) {
  const p = Math.floor(a.length / n) || 1
  return a.slice(0, p * n).filter((_, i) => i % p === 0)
}
function WiggleTrackComponent(props) {
  const { model } = props
  const { stats, ready, error } = model

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
  const getSubtrackRendererConf = (subtrack, slot) =>
    readConfObject(subtrack.configuration.renderer, slot)

  const getSubtrackConf = (subtrack, slot) =>
    readConfObject(subtrack.configuration, slot)

  const getYScaleBar = subtrack => {
    const scaleType = getSubtrackRendererConf(subtrack, 'scaleType')
    const inverted = getSubtrackRendererConf(subtrack, 'inverted')
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
  const getSubtrackLabel = subtrack => {
    console.log(subtrack, getSubtrackConf(subtrack, 'name'))
    return (
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          zIndex: 100,
          display: 'block',
          backgroundColor: '#fffc',
          border: '1px solid #ccc',
          fontSize: '11px',
        }}
        className="subtrackLabel"
      >
        {getSubtrackConf(subtrack, 'name')}
      </div>
    )
  }

  const getSubtrack = subtrack => {
    const needsScalebar =
      getSubtrackRendererConf(subtrack, 'renderType') === 'xyplot'
    return (
      <div
        key={subtrack.id}
        style={{ position: 'relative', height: subtrack.height }}
      >
        {needsScalebar ? getYScaleBar(subtrack) : null}
        {getSubtrackLabel(subtrack)}
        <subtrack.reactComponent {...props} model={subtrack} />
      </div>
    )
  }
  return (
    <Track {...props}>
      {model.subtracks.map(subtrack => getSubtrack(subtrack))}
    </Track>
  )
}
export default observer(WiggleTrackComponent)
