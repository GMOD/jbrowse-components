import React, { Component } from 'react'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'

import './PileupRendering.scss'
import PrerenderedCanvas from './PrerenderedCanvas'

import { PropTypes as CommonPropTypes } from '../../../mst-types'
import { bpToPx } from '../../../util'

function distance(x1, y1, x2, y2) {
  const dx = x1 - x2
  const dy = y1 - y2
  return Math.sqrt(dx * dx + dy * dy)
}

const layoutPropType = ReactPropTypes.shape({
  getRectangles: ReactPropTypes.func.isRequired,
})

@observer
class PileupRendering extends Component {
  static propTypes = {
    layout: layoutPropType.isRequired,
    height: ReactPropTypes.number.isRequired,
    width: ReactPropTypes.number.isRequired,
    region: CommonPropTypes.Region.isRequired,
    bpPerPx: ReactPropTypes.number.isRequired,
    horizontallyFlipped: ReactPropTypes.bool,

    onFeatureMouseDown: ReactPropTypes.func,
    onFeatureMouseEnter: ReactPropTypes.func,
    onFeatureMouseOut: ReactPropTypes.func,
    onFeatureMouseOver: ReactPropTypes.func,
    onFeatureMouseUp: ReactPropTypes.func,
    onFeatureMouseLeave: ReactPropTypes.func,
    onFeatureMouseMove: ReactPropTypes.func,

    // synthesized from mouseup and mousedown
    onFeatureClick: ReactPropTypes.func,
  }

  static defaultProps = {
    horizontallyFlipped: false,

    onFeatureMouseDown: () => {},
    onFeatureMouseEnter: () => {},
    onFeatureMouseOut: () => {},
    onFeatureMouseOver: () => {},
    onFeatureMouseUp: () => {},
    onFeatureMouseLeave: () => {},
    onFeatureMouseMove: () => {},

    onFeatureClick: () => {},
  }

  constructor(props) {
    super(props)
    this.highlightOverlayCanvas = React.createRef()
  }

  onMouseDown = event => {
    this.callFeatureMouseHandler('onFeatureMouseDown', event)
    if (this.featureUnderMouse) {
      this.lastFeatureMouseDown = {
        featureId: this.featureUnderMouse,
        x: event.clientX,
        y: event.clientY,
      }
    } else {
      this.lastFeatureMouseDown = undefined
    }
  }

  onMouseEnter = event => {
    this.callFeatureMouseHandler('onFeatureMouseEnter', event)
  }

  onMouseOut = event => {
    this.callFeatureMouseHandler('onFeatureMouseOut', event)
    this.callFeatureMouseHandler('onFeatureMouseLeave', event)
    this.featureUnderMouse = undefined
  }

  onMouseOver = event => {
    this.callFeatureMouseHandler('onFeatureMouseOver', event)
  }

  onMouseUp = event => {
    this.callFeatureMouseHandler('onFeatureMouseUp', event)

    // synthesize a featureClick event if we are on a feature
    // and it's close to the last mouse down
    if (this.featureUnderMouse && this.lastFeatureMouseDown) {
      const { featureId, x, y } = this.lastFeatureMouseDown
      const { clientX, clientY } = event
      if (
        this.featureUnderMouse === featureId &&
        distance(x, y, clientX, clientY) <= 2
      ) {
        this.callFeatureMouseHandler('onFeatureClick', event)
        this.lastFeatureMouseDown = undefined
      }
    }
  }

  onMouseLeave = event => {
    this.callFeatureMouseHandler('onFeatureMouseOut', event)
    this.callFeatureMouseHandler('onFeatureMouseLeave', event)
    this.featureUnderMouse = undefined
  }

  onMouseMove = event => {
    const featureIdCurrentlyUnderMouse = this.findFeatureIdUnderMouse(event)
    if (this.featureUnderMouse === featureIdCurrentlyUnderMouse) {
      this.callFeatureMouseHandler('onFeatureMouseMove', event)
    } else {
      if (this.featureUnderMouse) {
        this.callFeatureMouseHandler('onFeatureMouseOut', event)
        this.callFeatureMouseHandler('onFeatureMouseLeave', event)
      }
      this.featureUnderMouse = featureIdCurrentlyUnderMouse
      this.callFeatureMouseHandler('onFeatureMouseOver', event)
      this.callFeatureMouseHandler('onFeatureMouseEnter', event)
    }
  }

  findFeatureIdUnderMouse(event) {
    const { offsetX, offsetY } = event.nativeEvent
    if (!(offsetX >= 0))
      throw new Error(
        'invalid offsetX, does this browser provide offsetX and offsetY on mouse events?',
      )

    const { layout, bpPerPx, region, horizontallyFlipped } = this.props
    for (const [
      id,
      [leftBp, topPx, rightBp, bottomPx],
    ] of layout.getRectangles()) {
      let leftPx = bpToPx(leftBp, region, bpPerPx, horizontallyFlipped)
      let rightPx = bpToPx(rightBp, region, bpPerPx, horizontallyFlipped)
      if (horizontallyFlipped) {
        ;[leftPx, rightPx] = [rightPx, leftPx]
      }
      if (
        offsetX >= leftPx &&
        offsetX <= rightPx &&
        offsetY >= topPx &&
        offsetY <= bottomPx
      ) {
        return id
      }
    }

    return undefined
  }

  callFeatureMouseHandler(handlerName, event, always = false) {
    if (always || this.featureUnderMouse) {
      this.props[handlerName](this.featureUnderMouse, event)
    }
  }

  render() {
    const { layout, width, height } = this.props
    return (
      <div className="PileupRendering" style={{ position: 'relative' }}>
        <PrerenderedCanvas {...this.props} />
        <canvas
          width={width}
          height={height}
          style={{ position: 'absolute', left: 0, top: 0 }}
          className="highlightOverlayCanvas"
          ref={this.highlightOverlayCanvas}
          onMouseDown={this.onMouseDown}
          onMouseEnter={this.onMouseEnter}
          onMouseOut={this.onMouseOut}
          onMouseOver={this.onMouseOver}
          onMouseUp={this.onMouseUp}
          onMouseLeave={this.onMouseLeave}
          onMouseMove={this.onMouseMove}
          onFocus={() => {}}
          onBlur={() => {}}
        />
      </div>
    )
  }
}
export default PileupRendering
