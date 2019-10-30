/* eslint-disable react/require-default-props */
import { PropTypes as CommonPropTypes } from '@gmod/jbrowse-core/mst-types'
import { makeStyles } from '@material-ui/core/styles'
import { bpToPx } from '@gmod/jbrowse-core/util'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React, { useRef, useState, useEffect } from 'react'
import PrerenderedCanvas from '@gmod/jbrowse-core/components/PrerenderedCanvas'
import runner from 'mobx-run-in-reactive-context'
import useTimeout from 'use-timeout'

const useStyles = makeStyles(theme => ({
  hoverLabel: {
    border: '1px solid black',
    position: 'absolute',
    pointerEvents: 'none',
    zIndex: 10000,
  },
}))

function Tooltip({ offsetX, offsetY, feature, timeout = 300 }) {
  const classes = useStyles()
  const [hidden, setHidden] = useState(true)
  useTimeout(() => setHidden(false), timeout)
  return hidden ? null : (
    <div className={classes.hoverLabel} style={{ left: offsetX, top: offsetY }}>
      {feature.get('name')}
    </div>
  )
}

Tooltip.propTypes = {
  offsetX: ReactPropTypes.number.isRequired,
  offsetY: ReactPropTypes.number.isRequired,
  feature: ReactPropTypes.shape({ get: ReactPropTypes.func }).isRequired,
  timeout: ReactPropTypes.number,
}

function PileupRendering(props) {
  const {
    trackModel,
    width,
    height,
    region,
    bpPerPx,
    horizontallyFlipped,
  } = props
  const { selectedFeatureId, layoutFeatures, features } = trackModel

  const highlightOverlayCanvas = useRef()
  const [featureIdUnderMouse, setFeatureIdUnderMouse] = useState()
  const [mouseIsDown, setMouseIsDown] = useState(false)
  const [movedDuringLastMouseDown, setMovedDuringLastMouseDown] = useState(
    false,
  )
  const [offset, setOffset] = useState([0, 0])
  useEffect(() => {
    const canvas = highlightOverlayCanvas.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (!selectedFeatureId) return
    const rect = layoutFeatures.get(selectedFeatureId)
    if (!rect) return

    const [leftBp, topPx, rightBp, bottomPx] = rect
    const leftPx = Math.round(
      bpToPx(leftBp, region, bpPerPx, horizontallyFlipped),
    )
    const rightPx = Math.round(
      bpToPx(rightBp, region, bpPerPx, horizontallyFlipped),
    )
    const rectTop = Math.round(topPx)
    const rectHeight = Math.round(bottomPx - topPx)
    ctx.shadowColor = '#222266'
    ctx.shadowBlur = 10
    ctx.lineJoin = 'bevel'
    ctx.lineWidth = 2
    ctx.strokeStyle = '#00b8ff'
    ctx.strokeRect(
      leftPx - 2,
      rectTop - 2,
      rightPx - leftPx + 4,
      rectHeight + 4,
    )
    ctx.clearRect(leftPx, rectTop, rightPx - leftPx, rectHeight)
  }, [bpPerPx, horizontallyFlipped, region, selectedFeatureId, layoutFeatures])

  function onMouseDown(event) {
    setMouseIsDown(true)
    setMovedDuringLastMouseDown(false)
    callMouseHandler('MouseDown', event)
  }

  function onMouseEnter(event) {
    callMouseHandler('MouseEnter', event)
  }

  function onMouseOut(event) {
    callMouseHandler('MouseOut', event)
    callMouseHandler('MouseLeave', event)
    setFeatureIdUnderMouse()
  }

  function onMouseOver(event) {
    callMouseHandler('MouseOver', event)
  }

  function onMouseUp(event) {
    setMouseIsDown(false)
    callMouseHandler('MouseUp', event)
  }

  function onClick(event) {
    if (!movedDuringLastMouseDown) callMouseHandler('Click', event, true)
  }

  function onMouseLeave(event) {
    callMouseHandler('MouseOut', event)
    callMouseHandler('MouseLeave', event)
    setFeatureIdUnderMouse()
  }

  function onMouseMove(event) {
    if (mouseIsDown) setMovedDuringLastMouseDown(true)
    let offsetX = 0
    let offsetY = 0
    if (highlightOverlayCanvas.current) {
      offsetX = highlightOverlayCanvas.current.getBoundingClientRect().left
      offsetY = highlightOverlayCanvas.current.getBoundingClientRect().top
    }
    offsetX = event.clientX - offsetX
    offsetY = event.clientY - offsetY
    const px = horizontallyFlipped ? width - offsetX : offsetX
    const clientBp = region.start + bpPerPx * px

    const feats = trackModel.getFeatureOverlapping(clientBp, offsetY)
    const featureIdCurrentlyUnderMouse = feats.length
      ? feats[0].name
      : undefined
    setOffset([offsetX, offsetY])

    if (featureIdUnderMouse === featureIdCurrentlyUnderMouse) {
      callMouseHandler('MouseMove', event)
    } else {
      if (featureIdUnderMouse) {
        callMouseHandler('MouseOut', event)
        callMouseHandler('MouseLeave', event)
      }
      setFeatureIdUnderMouse(featureIdCurrentlyUnderMouse)
      callMouseHandler('MouseOver', event)
      callMouseHandler('MouseEnter', event)
    }
  }

  /**
   * @param {string} handlerName
   * @param {*} event - the actual mouse event
   * @param {bool} always - call this handler even if there is no feature
   */
  function callMouseHandler(handlerName, event, always = false) {
    const featureHandler = props[`onFeature${handlerName}`]
    const canvasHandler = props[`on${handlerName}`]
    if (featureHandler && (always || featureIdUnderMouse)) {
      featureHandler(event, featureIdUnderMouse)
    } else if (canvasHandler) {
      canvasHandler(event, featureIdUnderMouse)
    }
  }

  const canvasWidth = Math.ceil(width)
  // need to call this in render so we get the right observer behavior
  return (
    <div
      className="PileupRendering"
      style={{ position: 'relative', width: canvasWidth, height }}
    >
      <PrerenderedCanvas
        {...props}
        style={{ position: 'absolute', left: 0, top: 0 }}
      />
      <canvas
        width={canvasWidth}
        height={height}
        style={{ position: 'absolute', left: 0, top: 0 }}
        className="highlightOverlayCanvas"
        ref={highlightOverlayCanvas}
        onMouseDown={event => runner(() => onMouseDown(event))}
        onMouseEnter={event => runner(() => onMouseEnter(event))}
        onMouseOut={event => runner(() => onMouseOut(event))}
        onMouseOver={event => runner(() => onMouseOver(event))}
        onMouseUp={event => runner(() => onMouseUp(event))}
        onMouseLeave={event => runner(() => onMouseLeave(event))}
        onMouseMove={event => runner(() => onMouseMove(event))}
        onClick={event => runner(() => onClick(event))}
        onFocus={() => {}}
        onBlur={() => {}}
      />
      {featureIdUnderMouse ? (
        <Tooltip
          feature={features.get(featureIdUnderMouse)}
          offsetX={offset[0]}
          offsetY={offset[1]}
        />
      ) : null}
    </div>
  )
}

PileupRendering.propTypes = {
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

PileupRendering.defaultProps = {
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

export default observer(PileupRendering)
