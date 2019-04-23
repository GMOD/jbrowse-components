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
    trackModel: ReactPropTypes.shape({
      /** id of the currently selected feature, if any */
      selectedFeatureId: ReactPropTypes.string,
    }),
  }

  static defaultProps = {
    horizontallyFlipped: false,
    trackModel: {},
  }

  constructor(props) {
    super(props)
    this.state = {}
  }

  onMouseDown(evt) {
    this.callMouseHandler('MouseDown', evt)
    if (this.state.featureUnderMouse) {
      evt.persist()
      console.log(this.state.lastFeatureMouseDown)
      this.setState(oldState => ({
        lastFeatureMouseDown: {
          featureId: oldState.featureUnderMouse,
          x: evt.clientX,
          y: evt.clientY,
        },
      }))
    } else {
      this.setState({ lastFeatureMouseDown: undefined })
    }
  }

  onMouseMove(evt) {
    const { region, features, bpPerPx, horizontallyFlipped, width } = this.props
    const { offsetX } = evt.nativeEvent
    const px = horizontallyFlipped ? width - offsetX : offsetX
    const clientBp = region.start + bpPerPx * px
    for (const feature of features.values()) {
      if (clientBp <= feature.get('end') && clientBp >= feature.get('start')) {
        this.setState({ offsetX, featureUnderMouse: feature })
        return
      }
    }
  }

  onMouseLeave() {
    this.setState({ featureUnderMouse: undefined })
  }

  /**
   * @param {string} handlerName
   * @param {*} event - the actual mouse event
   * @param {bool} always - call this handler even if there is no feature
   */
  callMouseHandler(handlerName, event, always = false) {
    // eslint-disable-next-line react/destructuring-assignment
    const featureHandler = this.props[`onFeature${handlerName}`]
    console.log(handlerName, event)
    // eslint-disable-next-line react/destructuring-assignment
    const canvasHandler = this.props[`on${handlerName}`]
    if (featureHandler && (always || this.state.featureUnderMouse)) {
      featureHandler(event, this.state.featureUnderMouse)
    } else if (canvasHandler) {
      canvasHandler(event, this.state.featureUnderMouse)
    }
  }

  render() {
    const { width } = this.props
    const { featureUnderMouse, offsetX } = this.state
    return (
      <div
        onMouseMove={this.onMouseMove.bind(this)}
        onMouseLeave={this.onMouseLeave.bind(this)}
        onMouseDown={this.onMouseDown.bind(this)}
        role="presentation"
        onFocus={() => {}}
        className="WiggleRendering"
        style={{ position: 'relative' }}
      >
        <PrerenderedCanvas {...this.props} width={width} />
        {featureUnderMouse ? (
          <div style={{ pointerEvents: 'none' }}>
            <div className="hoverLabel" style={{ left: `${offsetX}px` }}>
              {parseFloat(featureUnderMouse.get('score').toPrecision(6))}
            </div>
            <div className="hoverVertical" style={{ left: `${offsetX}px` }} />
          </div>
        ) : null}
      </div>
    )
  }
}

export default observer(WiggleRendering)
