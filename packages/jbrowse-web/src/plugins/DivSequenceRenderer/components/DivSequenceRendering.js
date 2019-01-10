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
    horizontallyFlipped: ReactPropTypes.bool,
    features: ReactPropTypes.instanceOf(Map),
    config: CommonPropTypes.ConfigSchema.isRequired,
    trackModel: ReactPropTypes.shape({
      /** id of the currently selected feature, if any */
      selectedFeatureId: ReactPropTypes.string,
    }),
  }

  static defaultProps = {
    horizontallyFlipped: false,

    trackModel: {},

    features: new Map(),
  }

  render() {
    const {
      region,
      bpPerPx,
      horizontallyFlipped,
      config,
      features,
      trackModel: { selectedFeatureId },
    } = this.props

    const featuresRendered = []
    for (const seq of features.values()) {
      console.log(seq)
    }

    const width = (region.end - region.start) / bpPerPx
    const height = 200

    return (
      <div
        className="DivSequenceRendering"
        width={`${width}px`}
        height={`${height}px`}
        style={{
          position: 'relative',
        }}
      >
        Hello world
      </div>
    )
  }
}
export default DivSequenceRendering
