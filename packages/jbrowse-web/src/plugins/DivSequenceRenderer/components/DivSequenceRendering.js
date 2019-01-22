import React from 'react'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'

import './DivSequenceRendering.scss'

import { PropTypes as CommonPropTypes } from '../../../mst-types'

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

function DivSequenceRendering(props) {
  const { bpPerPx } = props
  return (
    <div className="DivSequenceRendering">
      {bpPerPx >= 1 ? (
        <div className="blur">Zoom in to see sequence</div>
      ) : (
        <SequenceDivs {...props} />
      )}
    </div>
  )
}

export default observer(DivSequenceRendering)
