import React, { Component } from 'react'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'

import './WiggleRendering.scss'
import PrerenderedCanvas from './PrerenderedCanvas'

import { PropTypes as CommonPropTypes } from '../../../mst-types'

@observer
class WiggleRendering extends Component {
  static propTypes = {
    height: ReactPropTypes.number.isRequired,
    width: ReactPropTypes.number.isRequired,
    region: CommonPropTypes.Region.isRequired,
    bpPerPx: ReactPropTypes.number.isRequired,
    horizontallyFlipped: ReactPropTypes.bool,
    trackModel: ReactPropTypes.shape({}),
  }

  static defaultProps = {
    horizontallyFlipped: false,

    trackModel: {},
  }

  render() {
    const { width } = this.props
    const canvasWidth = Math.ceil(width)
    // need to call this in render so we get the right observer behavior
    return (
      <div className="WiggleRendering" style={{ position: 'relative' }}>
        <PrerenderedCanvas {...this.props} width={canvasWidth} />
      </div>
    )
  }
}

export default WiggleRendering
