import React, { useEffect, useRef, useState } from 'react'

import { PrerenderedCanvas } from '@jbrowse/core/ui'
import { bpSpanPx } from '@jbrowse/core/util'
import { observer } from 'mobx-react'


import type { LaidOutFeatureRect } from '../FeatureGlyph'
import type { Region } from '@jbrowse/core/util/types'
import type { BaseLinearDisplayModel } from '@jbrowse/plugin-linear-genome-view'

// used so that user can click-away-from-feature below the laid out features
// (issue #1248)
const canvasPadding = 100

const CanvasFeatureRendering = observer(function (props: {
  blockKey: string
  displayModel?: BaseLinearDisplayModel
  width: number
  height: number
  regions: Region[]
  bpPerPx: number
  layoutRecords: LaidOutFeatureRect[]
  onMouseMove?: (event: React.MouseEvent, featureId?: string) => void
}) {
  const {
    onMouseMove,
    blockKey,
    displayModel,
    width,
    height,
    regions,
    bpPerPx,
  } = props

  const { selectedFeatureId, featureIdUnderMouse, contextMenuFeature } =
    displayModel || {}

  const region = regions[0]!
  const highlightOverlayCanvas = useRef<HTMLCanvasElement>(null)
  const [mouseIsDown, setMouseIsDown] = useState(false)
  const [movedDuringLastMouseDown, setMovedDuringLastMouseDown] =
    useState(false)

  useEffect(() => {
    const canvas = highlightOverlayCanvas.current
    if (!canvas) {
      return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const selectedRect = selectedFeatureId
      ? displayModel?.getFeatureByID(blockKey, selectedFeatureId)
      : undefined
    if (selectedRect) {
      const [leftBp, topPx, rightBp, bottomPx] = selectedRect
      const [leftPx, rightPx] = bpSpanPx(leftBp, rightBp, region, bpPerPx)
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
    }
    const highlightedFeature = featureIdUnderMouse || contextMenuFeature?.id()
    const highlightedRect = highlightedFeature
      ? displayModel?.getFeatureByID(blockKey, highlightedFeature)
      : undefined
    if (highlightedRect) {
      const [leftBp, topPx, rightBp, bottomPx] = highlightedRect
      const [leftPx, rightPx] = bpSpanPx(leftBp, rightBp, region, bpPerPx)
      const rectTop = Math.round(topPx)
      const rectHeight = Math.round(bottomPx - topPx)
      ctx.fillStyle = '#0003'
      ctx.fillRect(leftPx, rectTop, rightPx - leftPx, rectHeight)
    }
  }, [
    bpPerPx,
    region,
    blockKey,
    selectedFeatureId,
    displayModel,
    featureIdUnderMouse,
    contextMenuFeature,
  ])

  function onMouseDown(event: React.MouseEvent) {
    setMouseIsDown(true)
    setMovedDuringLastMouseDown(false)
    callMouseHandler('MouseDown', event)
  }

  function onMouseEnter(event: React.MouseEvent) {
    callMouseHandler('MouseEnter', event)
  }

  function onMouseOut(event: React.MouseEvent) {
    callMouseHandler('MouseOut', event)
    callMouseHandler('MouseLeave', event)
  }

  function onMouseOver(event: React.MouseEvent) {
    callMouseHandler('MouseOver', event)
  }

  function onMouseUp(event: React.MouseEvent) {
    setMouseIsDown(false)
    callMouseHandler('MouseUp', event)
  }

  function onClick(event: React.MouseEvent) {
    if (!movedDuringLastMouseDown) {
      callMouseHandler('Click', event)
    }
  }

  function onMouseLeave(event: React.MouseEvent) {
    callMouseHandler('MouseOut', event)
    callMouseHandler('MouseLeave', event)
  }

  function onContextMenu(event: React.MouseEvent) {
    callMouseHandler('ContextMenu', event)
  }

  function mouseMove(event: React.MouseEvent) {
    if (mouseIsDown) {
      setMovedDuringLastMouseDown(true)
    }
    let offsetX = 0
    let offsetY = 0
    const canvas = highlightOverlayCanvas.current
    if (canvas) {
      const { left, top } = canvas.getBoundingClientRect()
      offsetX = left
      offsetY = top
    }
    offsetX = event.clientX - offsetX
    offsetY = event.clientY - offsetY
    const px = region.reversed ? width - offsetX : offsetX
    const clientBp = region.start + bpPerPx * px

    const featIdUnderMouse = displayModel?.getFeatureOverlapping(
      blockKey,
      clientBp,
      offsetY,
    )

    if (onMouseMove) {
      onMouseMove(event, featIdUnderMouse)
    }
  }

  function callMouseHandler(handlerName: string, event: React.MouseEvent) {
    // @ts-ignore

    const featureHandler = props[`onFeature${handlerName}`]
    // @ts-ignore

    const canvasHandler = props[`on${handlerName}`]
    if (featureHandler && featureIdUnderMouse) {
      featureHandler(event, featureIdUnderMouse)
    } else if (canvasHandler) {
      canvasHandler(event, featureIdUnderMouse)
    }
  }

  const canvasWidth = Math.ceil(width)
  return (
    <div
      className="CanvasRendering"
      style={{ position: 'relative', width: canvasWidth, height }}
    >
      <PrerenderedCanvas
        {...props}
        style={{ position: 'absolute', left: 0, top: 0 }}
      />
      <canvas
        data-testid="canvas_overlay_canvas"
        width={canvasWidth}
        height={height + canvasPadding}
        style={{ position: 'absolute', left: 0, top: 0 }}
        ref={highlightOverlayCanvas}
        onMouseDown={event => {
          onMouseDown(event)
        }}
        onMouseEnter={event => {
          onMouseEnter(event)
        }}
        onMouseOut={event => {
          onMouseOut(event)
        }}
        onMouseOver={event => {
          onMouseOver(event)
        }}
        onMouseUp={event => {
          onMouseUp(event)
        }}
        onMouseLeave={event => {
          onMouseLeave(event)
        }}
        onMouseMove={event => {
          mouseMove(event)
        }}
        onClick={event => {
          onClick(event)
        }}
        onContextMenu={event => {
          onContextMenu(event)
        }}
        onFocus={() => {}}
        onBlur={() => {}}
      />
    </div>
  )
})

export default CanvasFeatureRendering
