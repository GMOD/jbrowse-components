import React, { Component } from 'react'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'

import './WiggleRendering.scss'
import PrerenderedCanvas from './PrerenderedCanvas'

import { PropTypes as CommonPropTypes } from '../../../mst-types'

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

  constructor(props) {
    super(props)
    this.state = {}
  }

  onMouseMove(evt) {
    const { region, features, bpPerPx, horizontallyFlipped, width } = this.props
    const { offsetX } = evt.nativeEvent
    const px = horizontallyFlipped ? width - offsetX : offsetX
    const clientBp = region.start + bpPerPx * px
    for (const feature of features.values()) {
      if (clientBp <= feature.get('end') && clientBp >= feature.get('start')) {
        this.setState({ offsetX, feature })
        return
      }
    }
  }

  onMouseLeave() {
    this.setState({ feature: undefined })
  }

  render() {
    const { width } = this.props
    const { feature, offsetX } = this.state
    return (
      <>
        <div
          onMouseMove={this.onMouseMove.bind(this)}
          onMouseLeave={this.onMouseLeave.bind(this)}
          onFocus={() => {}}
          className="WiggleRendering"
          style={{ position: 'relative' }}
        >
          <PrerenderedCanvas {...this.props} width={width} />
          {feature ? (
            <div style={{ pointerEvents: 'none' }}>
              <div className="hoverLabel" style={{ left: `${offsetX}px` }}>
                {parseFloat(feature.get('score').toPrecision(6))}
              </div>
              <div className="hoverVertical" style={{ left: `${offsetX}px` }} />
            </div>
          ) : null}
        </div>
      </>
    )
  }
}

export default observer(WiggleRendering)
