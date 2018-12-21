import React, { Component } from 'react'
import ReactPropTypes from 'prop-types'

import './SvgFeatureRendering.scss'

import { PropTypes as CommonPropTypes } from '../../../mst-types'
import { readConfObject } from '../../../configuration'
import { bpToPx } from '../../../util'
// import { bpToPx } from '../../../util'

// const layoutPropType = ReactPropTypes.shape({
//   getRectangles: ReactPropTypes.func.isRequired,
// })

export default class Box extends Component {
  static propTypes = {
    feature: ReactPropTypes.shape({ get: ReactPropTypes.func.isRequired })
      .isRequired,
    horizontallyFlipped: ReactPropTypes.bool,
    // bpPerPx: ReactPropTypes.number.isRequired,
    // region: CommonPropTypes.Region.isRequired,
    // config: CommonPropTypes.ConfigSchema.isRequired,
    layoutRecord: ReactPropTypes.shape({
      startPx: ReactPropTypes.number.isRequired,
      endPx: ReactPropTypes.number.isRequired,
      heightPx: ReactPropTypes.number.isRequired,
      topPx: ReactPropTypes.number.isRequired,
    }).isRequired,

    config: CommonPropTypes.ConfigSchema.isRequired,
  }

  static defaultProps = {
    horizontallyFlipped: false,
  }

  static layout({
    feature,
    horizontallyFlipped,
    bpPerPx,
    region,
    config,
    layout,
  }) {
    // ctx.fillRect(startPx, topPx, endPx - startPx, heightPx)
    if (horizontallyFlipped)
      throw new Error('horizontal flipping not yet implemented')

    let startPx = bpToPx(
      feature.get('start'),
      region,
      bpPerPx,
      horizontallyFlipped,
    )
    let endPx = bpToPx(feature.get('end'), region, bpPerPx, horizontallyFlipped)
    if (horizontallyFlipped) [startPx, endPx] = [endPx, startPx]
    const heightPx = readConfObject(config, 'height', [feature])
    if (!heightPx) debugger

    const topPx = layout.addRect(
      feature.id(),
      feature.get('start'),
      feature.get('end'),
      heightPx, // height
      feature,
    )

    return { startPx, endPx, heightPx, topPx }
  }

  render() {
    const {
      feature,
      horizontallyFlipped,
      config,
      layoutRecord: { startPx, endPx, heightPx, topPx },
    } = this.props
    // ctx.fillRect(startPx, topPx, endPx - startPx, heightPx)
    if (horizontallyFlipped)
      throw new Error('horizontal flipping not yet implemented')

    return (
      <rect
        title={feature.id()}
        x={startPx}
        y={topPx}
        width={endPx - startPx}
        height={heightPx}
        style={{ fill: readConfObject(config, 'color1') }}
      />
    )
  }
}
