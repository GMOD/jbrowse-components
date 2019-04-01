import React from 'react'
import { observer } from 'mobx-react'

import Track from '../../LinearGenomeView/components/Track'
import YScaleBar from './YScaleBar'
import { readConfObject, getConf } from '../../../configuration'

function WiggleTrackComponent(props) {
  const { model } = props
  const { yScale, ready, error } = model

  if (error) {
    return <div className="blur">{error}</div>
  }
  if (!ready) {
    return <div className="blur">Loading stats</div>
  }
  const minScore = getConf(model, 'minScore')
  const maxScore = getConf(model, 'maxScore')
  const height = getConf(model, 'defaultHeight')
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
              <YScaleBar
                statsMin={yScale.min}
                statsMax={yScale.max}
                height={height}
                minScore={minScore}
                maxScore={maxScore}
              />
            ) : null}
          </div>
          <subtrack.reactComponent {...props} model={subtrack} />
        </div>
      ))}
    </Track>
  )
}
export default observer(WiggleTrackComponent)
