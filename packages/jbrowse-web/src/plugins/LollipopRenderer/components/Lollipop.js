import React, { Component } from 'react'
import ReactPropTypes from 'prop-types'

import { observer } from 'mobx-react'
import { PropTypes as CommonPropTypes } from '../../../mst-types'
import { readConfObject } from '../../../configuration'
import { featureSpanPx, bpToPx } from '../../../util'

class Lollipop extends Component {
  static propTypes = {
    feature: ReactPropTypes.shape({ get: ReactPropTypes.func.isRequired })
      .isRequired,
    // horizontallyFlipped: ReactPropTypes.bool,
    // bpPerPx: ReactPropTypes.number.isRequired,
    // region: CommonPropTypes.Region.isRequired,
    // config: CommonPropTypes.ConfigSchema.isRequired,
    layoutRecord: ReactPropTypes.shape({
      startPx: ReactPropTypes.number.isRequired,
      endPx: ReactPropTypes.number.isRequired,
      heightPx: ReactPropTypes.number.isRequired,
      topPx: ReactPropTypes.number.isRequired,
    }).isRequired,

    selectedFeatureId: ReactPropTypes.string,

    config: CommonPropTypes.ConfigSchema.isRequired,

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
    // horizontallyFlipped: false,

    selectedFeatureId: undefined,

    onFeatureMouseDown: undefined,
    onFeatureMouseEnter: undefined,
    onFeatureMouseOut: undefined,
    onFeatureMouseOver: undefined,
    onFeatureMouseUp: undefined,
    onFeatureMouseLeave: undefined,
    onFeatureMouseMove: undefined,

    onFeatureClick: undefined,
  }

  static layout(args) {
    const { feature, bpPerPx, region, layout, horizontallyFlipped } = args

    // const [startPx, endPx] = featureSpanPx(
    //   feature,
    //   region,
    //   bpPerPx,
    //   horizontallyFlipped,
    // )
    const centerBp = Math.abs(feature.get('end') + feature.get('start')) / 2
    const radiusPx = readConfObject(args.config, 'radius', [feature])
    const radiusBp = radiusPx * bpPerPx
    const startPx = bpToPx(
      centerBp - radiusBp,
      region,
      bpPerPx,
      horizontallyFlipped,
    )
    const endPx = bpToPx(
      centerBp + radiusBp,
      region,
      bpPerPx,
      horizontallyFlipped,
    )

    const topPx = layout.addRect(
      feature.id(),
      Math.floor(centerBp - radiusBp),
      Math.ceil(centerBp + radiusBp),
      radiusPx * 2,
      feature,
    )

    return { startPx, endPx, heightPx: radiusPx * 2, topPx }
  }

  onFeatureMouseDown = event => {
    const { onFeatureMouseDown: handler, feature } = this.props
    if (!handler) return undefined
    return handler(event, feature.id())
  }

  onFeatureMouseEnter = event => {
    const { onFeatureMouseEnter: handler, feature } = this.props
    if (!handler) return undefined
    return handler(event, feature.id())
  }

  onFeatureMouseOut = event => {
    const { onFeatureMouseOut: handler, feature } = this.props
    if (!handler) return undefined
    return handler(event, feature.id())
  }

  onFeatureMouseOver = event => {
    const { onFeatureMouseOver: handler, feature } = this.props
    if (!handler) return undefined
    return handler(event, feature.id())
  }

  onFeatureMouseUp = event => {
    const { onFeatureMouseUp: handler, feature } = this.props
    if (!handler) return undefined
    return handler(event, feature.id())
  }

  onFeatureMouseLeave = event => {
    const { onFeatureMouseLeave: handler, feature } = this.props
    if (!handler) return undefined
    return handler(event, feature.id())
  }

  onFeatureMouseMove = event => {
    const { onFeatureMouseMove: handler, feature } = this.props
    if (!handler) return undefined
    return handler(event, feature.id())
  }

  onFeatureClick = event => {
    const { onFeatureClick: handler, feature } = this.props
    if (!handler) return undefined
    event.stopPropagation()
    return handler(event, feature.id())
  }

  render() {
    const {
      feature,
      config,
      layoutRecord: { startPx, endPx, heightPx, topPx },
      selectedFeatureId,
    } = this.props

    const style = { fill: readConfObject(config, 'bodyColor', [feature]) }
    if (String(selectedFeatureId) === String(feature.id())) {
      style.fill = 'red'
    }

    return (
      <circle
        title={feature.id()}
        cx={startPx + (endPx - startPx) / 2}
        cy={topPx + heightPx / 2}
        r={heightPx / 2}
        style={style}
        onMouseDown={this.onFeatureMouseDown}
        onMouseEnter={this.onFeatureMouseEnter}
        onMouseOut={this.onFeatureMouseOut}
        onMouseOver={this.onFeatureMouseOver}
        onMouseUp={this.onFeatureMouseUp}
        onMouseLeave={this.onFeatureMouseLeave}
        onMouseMove={this.onFeatureMouseMove}
        onClick={this.onFeatureClick}
        onFocus={this.onFeatureMouseOver}
        onBlur={this.onFeatureMouseOut}
      />
    )
  }
}

export default observer(Lollipop)
