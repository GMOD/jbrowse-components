import React from 'react'
import { observer } from 'mobx-react'

import Track from '../../LinearGenomeView/components/Track'
import YScaleBar from './YScaleBar'
import { readConfObject } from '../../../configuration'

function WiggleTrackComponent(props) {
  const { model } = props
  const { yScale, ready, error } = model
  const { min, max } = yScale || {}

  if (error) {
    return <div className="blur">{error}</div>
  }
  if (!ready) {
    return <div className="blur">Loading stats</div>
  }
  return (
    <Track {...props}>
      {model.subtracks.map(subtrack => (
        <div
          key={subtrack.id}
          style={{ position: 'relative', height: subtrack.height }}
        >
          <div
            style={{
              position: 'absolute',
              top: '0px',
              zIndex: 100,
            }}
          >
            {readConfObject(subtrack.configuration.renderer, 'renderType') ===
            'xyplot' ? (
              <svg height={subtrack.height}>
                <YScaleBar
                  min={min}
                  max={max}
                  model={subtrack}
                  scaleType={readConfObject(
                    subtrack.configuration.renderer,
                    'scaleType',
                  )}
                />
              </svg>
            ) : null}
          </div>
          <subtrack.reactComponent {...props} model={subtrack} />
        </div>
      ))}
    </Track>
  )
}
export default observer(WiggleTrackComponent)
