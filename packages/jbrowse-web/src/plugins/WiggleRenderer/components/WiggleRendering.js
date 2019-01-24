import React from 'react'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'

import './WiggleRendering.scss'

import { PropTypes as CommonPropTypes } from '../../../mst-types'
import { readConfObject } from '../../../configuration'

function SequenceDivs({ features, region, bpPerPx, horizontallyFlipped }) {
  let s = ''
  for (const seq of features.values()) {
    s += seq.get('seq')
  }

  const width = (region.end - region.start) / bpPerPx

  s = s.split('')
  if (horizontallyFlipped) s = s.reverse()

  return (
    <>
      {s.map((letter, iter) => (
        <div
          /* eslint-disable-next-line */
          key={`${region.start}-${iter}`}
          style={{
            width: `${width / s.length}px`,
          }}
          className={`base base-${letter.toLowerCase()}`}
        >
          {bpPerPx < 0.1 ? letter : '\u00A0'}
        </div>
      ))}
    </>
  )
}

SequenceDivs.propTypes = {
  region: CommonPropTypes.Region.isRequired,
  bpPerPx: ReactPropTypes.number.isRequired,
  features: ReactPropTypes.instanceOf(Map),
  horizontallyFlipped: ReactPropTypes.bool,
}
SequenceDivs.defaultProps = {
  features: new Map(),
  horizontallyFlipped: false,
}

function WiggleRendering(props) {
  const { bpPerPx, config } = props
  const height = readConfObject(config, 'height')
  return (
    <div
      className="WiggleRendering"
      style={{ height: `${height}px`, fontSize: `${height * 0.8}px` }}
    >
      {bpPerPx >= 1 ? (
        <div className="blur">Zoom in to see sequence</div>
      ) : (
        <SequenceDivs {...props} />
      )}
    </div>
  )
}
WiggleRendering.propTypes = {
  config: CommonPropTypes.ConfigSchema.isRequired,
  bpPerPx: ReactPropTypes.number.isRequired,
}

export default observer(WiggleRendering)
