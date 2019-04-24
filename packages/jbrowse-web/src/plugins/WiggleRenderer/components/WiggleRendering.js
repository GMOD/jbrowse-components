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
    const { width } = this.props
    const { featureUnderMouse, offsetX } = this.state
    const displayedScore = ''
    let score = feature.get('score')
    if (summaryScoreMode === 'max') {
      score = maxr === undefined ? score : maxr
      ctx.fillStyle = c
      ctx.fillRect(leftPx, toY(score), w, filled ? toHeight(score) : 1)
    } else if (summaryScoreMode === 'min') {
      score = minr === undefined ? score : minr
      ctx.fillStyle = c
      ctx.fillRect(leftPx, toY(score), w, filled ? toHeight(score) : 1)
    } else if (summaryScoreMode === 'whiskers') {
      // max
      if (maxr !== undefined) {
        ctx.fillStyle = Color(c)
          .lighten(0.6)
          .toString()
        ctx.fillRect(leftPx, toY(maxr), w, filled ? toHeight(maxr) : 1)
      }

      // normal
      ctx.fillStyle = c
      ctx.fillRect(leftPx, toY(score), w, filled ? toHeight(score) : 1)
      // min
      if (minr !== undefined) {
        ctx.fillStyle = Color(c)
          .darken(0.6)
          .toString()
        ctx.fillRect(leftPx, toY(minr), w, filled ? toHeight(minr) : 1)
      }
    } else {
      ctx.fillStyle = c
      ctx.fillRect(leftPx, toY(score), w, filled ? toHeight(score) : 1)
    }
    return (
      <div
        onMouseMove={this.onMouseMove.bind(this)}
        onMouseLeave={this.onMouseLeave.bind(this)}
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
