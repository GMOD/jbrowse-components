import { PropTypes as CommonPropTypes } from '@gmod/jbrowse-core/mst-types'
import PrerenderedCanvas from '@gmod/jbrowse-core/components/PrerenderedCanvas'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React, { Component } from 'react'
import './WiggleRendering.scss'

const toP = s => parseFloat(s.toPrecision(6))

function Tooltip({ offsetX, feature }) {
  return (
    <>
      <div
        className="hoverLabel"
        style={{ left: `${offsetX}px`, zIndex: 10000 }}
      >
        {feature.get('maxScore') !== undefined ? (
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
        )}
      </div>
      <div className="hoverVertical" style={{ left: `${offsetX}px` }} />
    </>
  )
}

Tooltip.propTypes = {
  offsetX: ReactPropTypes.number.isRequired,
  feature: ReactPropTypes.shape({ get: ReactPropTypes.func }).isRequired,
}

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
    this.state = { hasLeft: false }
  }

  onMouseMove(evt) {
    const { region, features, bpPerPx, horizontallyFlipped, width } = this.props
    const { offsetX } = evt.nativeEvent
    const px = horizontallyFlipped ? width - offsetX : offsetX
    const clientBp = region.start + bpPerPx * px
    for (const feature of features.values()) {
      if (clientBp <= feature.get('end') && clientBp >= feature.get('start')) {
        this.setState({ offsetX, hasLeft: false, featureUnderMouse: feature })
        return
      }
    }
  }

  onMouseLeave() {
    this.setState({ hasLeft: true, featureUnderMouse: undefined })
  }

  onMouseEnter() {
    this.setState({ hasLeft: false })
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
    const { hasLeft, featureUnderMouse, offsetX } = this.state
    const { height } = this.props

    return (
      <div
        onMouseMove={this.onMouseMove.bind(this)}
        onMouseLeave={this.onMouseLeave.bind(this)}
        onMouseEnter={this.onMouseEnter.bind(this)}
        role="presentation"
        onFocus={() => {}}
        className="WiggleRendering"
        style={{
          overflow: 'visible',
          height,
        }}
      >
        <PrerenderedCanvas {...this.props} />
        {!hasLeft && featureUnderMouse ? (
          <Tooltip feature={featureUnderMouse} offsetX={offsetX} />
        ) : null}
      </div>
    )
  }
}

export default observer(WiggleRendering)
