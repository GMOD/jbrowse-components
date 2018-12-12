import React, { Component } from 'react'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'

import './PileupRendering.scss'
import PrerenderedCanvas from './PrerenderedCanvas'

import { PropTypes as CommonPropTypes } from '../../../mst-types'
import { bpToPx } from '../../../util'

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
    horizontallyFlipped: ReactPropTypes.bool.isRequired,
  }

  constructor(props) {
    super(props)
    this.highlightOverlayCanvas = React.createRef()
  }

  onMouseLeave = event => {
    const canvas = this.highlightOverlayCanvas.current
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
  }

  onMouseMove = event => {
    const { offsetX, offsetY } = event.nativeEvent
    if (!(offsetX >= 0))
      throw new Error(
        'invalid offsetX, does this browser provide offsetX and offsetY on mouse events?',
      )

    const { layout, bpPerPx, region, horizontallyFlipped } = this.props
    const canvas = this.highlightOverlayCanvas.current
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = 'rgba(0,0,0,0.2)'
    ctx.clearRect(0, 0, canvas.width, canvas.height)
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
        ctx.fillRect(leftPx, topPx, rightPx - leftPx, bottomPx - topPx)
        return
      }
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
          onMouseMove={this.onMouseMove}
          onMouseLeave={this.onMouseLeave}
        />
      </div>
    )
  }
}
export default PileupRendering
