import { PropTypes as CommonPropTypes } from '@gmod/jbrowse-core/mst-types'
import PrerenderedCanvas from '@gmod/jbrowse-core/components/PrerenderedCanvas'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React, { Component } from 'react'
import './WiggleRendering.scss'

class WiggleRendering extends Component {
  static propTypes = {
    height: ReactPropTypes.number.isRequired,
    width: ReactPropTypes.number.isRequired,
    region: CommonPropTypes.Region.isRequired,
    features: ReactPropTypes.instanceOf(Map).isRequired,
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
    // eslint-disable-next-line react/destructuring-assignment
    const canvasHandler = this.props[`on${handlerName}`]
    const { featureUnderMouse } = this.state
    if (featureHandler && (always || featureUnderMouse)) {
      featureHandler(event, featureUnderMouse)
    } else if (canvasHandler) {
      canvasHandler(event, featureUnderMouse)
    }
  }

  render() {
    const { featureUnderMouse, offsetX } = this.state

    const toP = s => parseFloat(s.toPrecision(6))
    const getFeatRepr = feature => {
      return feature.get('maxScore') !== undefined ? (
        <div>
          Summary
          <br />
          Max: {toP(feature.get('maxScore'))}
          <br />
          Avg: {toP(feature.get('score'))}
          <br />
          Min: {toP(feature.get('minScore'))}
        </div>
      ) : (
        toP(feature.get('score'))
      )
    }
    const getMouseoverFlag = feature => (
      <div style={{ pointerEvents: 'none' }}>
        <div className="hoverLabel" style={{ left: `${offsetX}px` }}>
          {getFeatRepr(feature)}
        </div>
        <div className="hoverVertical" style={{ left: `${offsetX}px` }} />
      </div>
    )
    return (
      <div
        onMouseMove={this.onMouseMove.bind(this)}
        onMouseLeave={this.onMouseLeave.bind(this)}
        role="presentation"
        onFocus={() => {}}
        className="WiggleRendering"
        style={{
          overflow: 'hidden',
          height: this.props.height,
          position: 'relative',
        }}
      >
        <PrerenderedCanvas {...this.props} />
        {featureUnderMouse ? getMouseoverFlag(featureUnderMouse) : null}
      </div>
    )
  }
}

export default observer(WiggleRendering)
