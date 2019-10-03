import { PropTypes as CommonPropTypes } from '@gmod/jbrowse-core/mst-types'
import { bpToPx } from '@gmod/jbrowse-core/util'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React, { Component } from 'react'
import PrerenderedCanvas from '@gmod/jbrowse-core/components/PrerenderedCanvas'
import runner from 'mobx-run-in-reactive-context'

const layoutPropType = ReactPropTypes.shape({
  getRectangles: ReactPropTypes.func.isRequired,
})

class PileupRendering extends Component {
  static propTypes = {
    layout: layoutPropType.isRequired,
    height: ReactPropTypes.number.isRequired,
    width: ReactPropTypes.number.isRequired,
    region: CommonPropTypes.Region.isRequired,
    bpPerPx: ReactPropTypes.number.isRequired,
    horizontallyFlipped: ReactPropTypes.bool,

    trackModel: ReactPropTypes.shape({
      /** id of the currently selected feature, if any */
      selectedFeatureId: ReactPropTypes.string,
      getFeatureOverlapping: ReactPropTypes.func,
    }),

    onFeatureMouseDown: ReactPropTypes.func,
    onFeatureMouseEnter: ReactPropTypes.func,
    onFeatureMouseOut: ReactPropTypes.func,
    onFeatureMouseOver: ReactPropTypes.func,
    onFeatureMouseUp: ReactPropTypes.func,
    onFeatureMouseLeave: ReactPropTypes.func,
    onFeatureMouseMove: ReactPropTypes.func,

    // synthesized from mouseup and mousedown
    onFeatureClick: ReactPropTypes.func,

    onMouseDown: ReactPropTypes.func,
    onMouseUp: ReactPropTypes.func,
    onMouseEnter: ReactPropTypes.func,
    onMouseLeave: ReactPropTypes.func,
    onMouseOver: ReactPropTypes.func,
    onMouseOut: ReactPropTypes.func,

    onClick: ReactPropTypes.func,
  }

  static defaultProps = {
    horizontallyFlipped: false,

    trackModel: {},

    onFeatureMouseDown: undefined,
    onFeatureMouseEnter: undefined,
    onFeatureMouseOut: undefined,
    onFeatureMouseOver: undefined,
    onFeatureMouseUp: undefined,
    onFeatureMouseLeave: undefined,
    onFeatureMouseMove: undefined,

    onFeatureClick: undefined,

    onMouseDown: undefined,
    onMouseUp: undefined,
    onMouseEnter: undefined,
    onMouseLeave: undefined,
    onMouseOver: undefined,
    onMouseOut: undefined,

    onClick: undefined,
  }

  constructor(props) {
    super(props)
    this.highlightOverlayCanvas = React.createRef()
  }

  componentDidMount() {
    this.updateSelectionHighlight()
  }

  componentDidUpdate() {
    this.updateSelectionHighlight()
  }

  onMouseDown = event => {
    this.callMouseHandler('MouseDown', event)
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
    this.callMouseHandler('MouseEnter', event)
  }

  onMouseOut = event => {
    this.callMouseHandler('MouseOut', event)
    this.callMouseHandler('MouseLeave', event)
    this.featureUnderMouse = undefined
  }

  onMouseOver = event => {
    this.callMouseHandler('MouseOver', event)
  }

  onMouseUp = event => {
    this.callMouseHandler('MouseUp', event)
  }

  onClick = event => {
    this.callMouseHandler('Click', event)
  }

  onMouseLeave = event => {
    this.callMouseHandler('MouseOut', event)
    this.callMouseHandler('MouseLeave', event)
    this.featureUnderMouse = undefined
  }

  onMouseMove = event => {
    const featureIdCurrentlyUnderMouse = this.findFeatureIdUnderMouse(event)
    if (this.featureUnderMouse === featureIdCurrentlyUnderMouse) {
      this.callMouseHandler('MouseMove', event)
    } else {
      if (this.featureUnderMouse) {
        this.callMouseHandler('MouseOut', event)
        this.callMouseHandler('MouseLeave', event)
      }
      this.featureUnderMouse = featureIdCurrentlyUnderMouse
      this.callMouseHandler('MouseOver', event)
      this.callMouseHandler('MouseEnter', event)
    }
  }

  updateSelectionHighlight() {
    const {
      trackModel,
      region,
      bpPerPx,
      layout,
      horizontallyFlipped,
    } = this.props
    const { selectedFeatureId } = trackModel

    const canvas = this.highlightOverlayCanvas.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (selectedFeatureId) {
      for (const [
        id,
        [leftBp, topPx, rightBp, bottomPx],
      ] of layout.getRectangles()) {
        if (String(id) === String(selectedFeatureId)) {
          const leftPx = Math.round(
            bpToPx(leftBp, region, bpPerPx, horizontallyFlipped),
          )
          const rightPx = Math.round(
            bpToPx(rightBp, region, bpPerPx, horizontallyFlipped),
          )
          const top = Math.round(topPx)
          const height = Math.round(bottomPx - topPx)
          ctx.shadowColor = '#222266'
          ctx.shadowBlur = 10
          ctx.lineJoin = 'bevel'
          ctx.lineWidth = 2
          ctx.strokeStyle = '#00b8ff'
          ctx.strokeRect(leftPx - 2, top - 2, rightPx - leftPx + 4, height + 4)
          ctx.clearRect(leftPx, top, rightPx - leftPx, height)
          return
        }
      }
    }
  }

  findFeatureIdUnderMouse(event) {
    const { offsetY } = event.nativeEvent
    const {
      width,
      horizontallyFlipped,
      bpPerPx,
      trackModel,
      region,
    } = this.props
    let offset = 0
    if (this.highlightOverlayCanvas.current) {
      offset = this.highlightOverlayCanvas.current.getBoundingClientRect().left
    }
    const offsetX = event.clientX - offset
    const px = horizontallyFlipped ? width - offsetX : offsetX
    const clientBp = region.start + bpPerPx * px

    const feat = trackModel.getFeatureOverlapping(clientBp, offsetY)
    return feat.length ? feat[0].name : undefined
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
    if (featureHandler && (always || this.featureUnderMouse)) {
      featureHandler(event, this.featureUnderMouse)
    } else if (canvasHandler) {
      canvasHandler(event, this.featureUnderMouse)
    }
  }

  render() {
    const { width, height } = this.props
    const canvasWidth = Math.ceil(width)

    // need to call this in render so we get the right observer behavior
    this.updateSelectionHighlight()
    return (
      <div
        className="PileupRendering"
        style={{ position: 'relative', width: canvasWidth, height }}
      >
        <PrerenderedCanvas
          {...this.props}
          style={{ position: 'absolute', left: 0, top: 0 }}
        />
        <canvas
          width={canvasWidth}
          height={height}
          style={{ position: 'absolute', left: 0, top: 0 }}
          className="highlightOverlayCanvas"
          ref={this.highlightOverlayCanvas}
          onMouseDown={event => runner(() => this.onMouseDown(event))}
          onMouseEnter={event => runner(() => this.onMouseEnter(event))}
          onMouseOut={event => runner(() => this.onMouseOut(event))}
          onMouseOver={event => runner(() => this.onMouseOver(event))}
          onMouseUp={event => runner(() => this.onMouseUp(event))}
          onMouseLeave={event => runner(() => this.onMouseLeave(event))}
          onMouseMove={event => runner(() => this.onMouseMove(event))}
          onClick={event => runner(() => this.onClick(event))}
          onFocus={() => {}}
          onBlur={() => {}}
        />
      </div>
    )
  }
}
export default observer(PileupRendering)
