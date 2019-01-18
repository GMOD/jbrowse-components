import React, { Component } from 'react'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'

import './DivSequenceRendering.scss'

import { PropTypes as CommonPropTypes } from '../../../mst-types'

@observer
class DivSequenceRendering extends Component {
  static propTypes = {
    region: CommonPropTypes.Region.isRequired,
    bpPerPx: ReactPropTypes.number.isRequired,
    features: ReactPropTypes.instanceOf(Map),
    trackModel: ReactPropTypes.shape({
      /** id of the currently selected feature, if any */
      selectedFeatureId: ReactPropTypes.string,
    }),
  }

  static defaultProps = {
    trackModel: {},

    features: new Map(),
  }

  render() {
    const { region, bpPerPx, features } = this.props

    let s = ''
    for (const seq of features.values()) {
      s += seq.seq || seq.data.seq // index.js:1452 Warning: Text content did not match. fix?
    }

    const width = (region.end - region.start) / bpPerPx

    return (
      <div className="DivSequenceRendering">
        {bpPerPx >= 1 ? (
          <div className="blur">Zoom in to see sequence</div>
        ) : (
          <div>
            {s.split('').map((letter, iter) => (
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
          </div>
        )}
      </div>
    )
  }
}
export default DivSequenceRendering
