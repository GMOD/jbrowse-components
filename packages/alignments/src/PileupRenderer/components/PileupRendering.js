import { PropTypes as CommonPropTypes } from '@gmod/jbrowse-core/mst-types'
import { makeStyles } from '@material-ui/core/styles'
import { bpToPx } from '@gmod/jbrowse-core/util'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React, { Component } from 'react'
import PrerenderedCanvas from '@gmod/jbrowse-core/components/PrerenderedCanvas'
import runner from 'mobx-run-in-reactive-context'

const useStyles = makeStyles(theme => ({
  hoverLabel: {
    border: '1px solid black',
    backgroundColor: '#fffa',
    position: 'absolute',
    pointerEvents: 'none',
    zIndex: 10000,
  },
}))
function Tooltip({ offsetX, offsetY, feature }) {
  const classes = useStyles()
  return (
    <>
      <div
        className={classes.hoverLabel}
        style={{ left: offsetX, top: offsetY }}
      >
        {feature.get('name')}
      </div>
    </>
  )
}

Tooltip.propTypes = {
  offsetX: ReactPropTypes.number.isRequired,
  offsetY: ReactPropTypes.number.isRequired,
  feature: ReactPropTypes.shape({ get: ReactPropTypes.func }).isRequired,
}

class PileupRendering extends Component {
  static propTypes = {
    layout: ReactPropTypes.shape({
      getRectangles: ReactPropTypes.func.isRequired,
    }).isRequired,
    height: ReactPropTypes.number.isRequired,
    width: ReactPropTypes.number.isRequired,
    region: CommonPropTypes.Region.isRequired,
    bpPerPx: ReactPropTypes.number.isRequired,
    horizontallyFlipped: ReactPropTypes.bool,

    trackModel: ReactPropTypes.shape({
      /** id of the currently selected feature, if any */
      selectedFeatureId: ReactPropTypes.string,
      getFeatureOverlapping: ReactPropTypes.func,
      features: ReactPropTypes.shape({ get: ReactPropTypes.func }),
      layoutFeatures: ReactPropTypes.shape({ get: ReactPropTypes.func }),
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
    this.state = {}
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
  }

  onMouseEnter = event => {
    this.callMouseHandler('MouseEnter', event)
  }

  onMouseOut = event => {
    this.callMouseHandler('MouseOut', event)
    this.callMouseHandler('MouseLeave', event)
    this.setState({ featureUnderMouse: undefined })
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
    this.setState({ featureUnderMouse: undefined })
  }

  onMouseMove = event => {
    const {
      width,
      horizontallyFlipped,
      bpPerPx,
      trackModel,
      region,
    } = this.props
    const { featureUnderMouse } = this.state
    let offsetX = 0
    let offsetY = 0
    if (this.highlightOverlayCanvas.current) {
      offsetX = this.highlightOverlayCanvas.current.getBoundingClientRect().left
      offsetY = this.highlightOverlayCanvas.current.getBoundingClientRect().top
    }
    offsetX = event.clientX - offsetX
    offsetY = event.clientY - offsetY
    const px = horizontallyFlipped ? width - offsetX : offsetX
    const clientBp = region.start + bpPerPx * px

    const feats = trackModel.getFeatureOverlapping(clientBp, offsetY)
    const featureIdCurrentlyUnderMouse = feats.length
      ? feats[0].name
      : undefined
    this.setState({ offsetX, offsetY })

    if (featureUnderMouse === featureIdCurrentlyUnderMouse) {
      this.callMouseHandler('MouseMove', event)
    } else {
      if (featureUnderMouse) {
        this.callMouseHandler('MouseOut', event)
        this.callMouseHandler('MouseLeave', event)
      }
      this.setState({ featureUnderMouse: featureIdCurrentlyUnderMouse })
      this.callMouseHandler('MouseOver', event)
      this.callMouseHandler('MouseEnter', event)
    }
  }

  updateSelectionHighlight() {
    const { trackModel, region, bpPerPx, horizontallyFlipped } = this.props
    const { selectedFeatureId } = trackModel

    const canvas = this.highlightOverlayCanvas.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (selectedFeatureId) {
      const res = trackModel.layoutFeatures.get(selectedFeatureId)
      if (res) {
        const [leftBp, topPx, rightBp, bottomPx] = res
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
      }
    }
  }

  findFeatureIdUnderMouse(event) {}

  /**
   * @param {string} handlerName
   * @param {*} event - the actual mouse event
   * @param {bool} always - call this handler even if there is no feature
   */
  callMouseHandler(handlerName, event, always = false) {
    const { featureUnderMouse } = this.state
    // eslint-disable-next-line react/destructuring-assignment
    const featureHandler = this.props[`onFeature${handlerName}`]
    // eslint-disable-next-line react/destructuring-assignment
    const canvasHandler = this.props[`on${handlerName}`]
    if (featureHandler && (always || featureUnderMouse)) {
      featureHandler(event, featureUnderMouse)
    } else if (canvasHandler) {
      canvasHandler(event, featureUnderMouse)
    }
  }

  render() {
    const { width, height, trackModel } = this.props
    const { featureUnderMouse, offsetX, offsetY } = this.state
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
        {featureUnderMouse ? (
          <Tooltip
            feature={trackModel.features.get(featureUnderMouse)}
            offsetX={offsetX}
            offsetY={offsetY}
          />
        ) : null}
      </div>
    )
  }
}
export default observer(PileupRendering)
