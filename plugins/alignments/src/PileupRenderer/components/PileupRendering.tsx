import { Region } from '@jbrowse/core/util/types'
import { PrerenderedCanvas } from '@jbrowse/core/ui'
import { bpSpanPx } from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import React, { MouseEvent, useRef, useState, useEffect } from 'react'
import type { BaseLinearDisplayModel } from '@jbrowse/plugin-linear-genome-view'

function PileupRendering(props: {
  blockKey: string
  displayModel: BaseLinearDisplayModel
  width: number
  height: number
  regions: Region[]
  bpPerPx: number
  sortedBy?: { type: string; pos: number; refName: string }
  colorBy?: { type: string; tag?: string }
  onMouseMove?: (event: React.MouseEvent, featureId: string | undefined) => void
}) {
  const {
    onMouseMove,
    blockKey,
    displayModel,
    width,
    height,
    regions,
    bpPerPx,
    sortedBy,
    colorBy,
  } = props
  const {
    selectedFeatureId,
    featureIdUnderMouse,
    contextMenuFeature,
    blockLayoutFeatures,
  } = displayModel || {}
  const [region] = regions
  const highlightOverlayCanvas = useRef<HTMLCanvasElement>(null)
  const [mouseIsDown, setMouseIsDown] = useState(false)
  const [movedDuringLastMouseDown, setMovedDuringLastMouseDown] = useState(
    false,
  )
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
    let rect
    let blockLayout

    if (
      selectedFeatureId &&
      (blockLayout = blockLayoutFeatures.get(blockKey)) &&
      (rect = blockLayout.get(selectedFeatureId))
    ) {
      const [leftBp, topPx, rightBp, bottomPx] = rect
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
    if (
      highlightedFeature &&
      (blockLayout = blockLayoutFeatures.get(blockKey)) &&
      (rect = blockLayout.get(highlightedFeature))
    ) {
      const [leftBp, topPx, rightBp, bottomPx] = rect
      const [leftPx, rightPx] = bpSpanPx(leftBp, rightBp, region, bpPerPx)
      const rectTop = Math.round(topPx)
      const rectHeight = Math.round(bottomPx - topPx)
      ctx.fillStyle = '#0003'
      ctx.fillRect(leftPx, rectTop, rightPx - leftPx, rectHeight)
    }
  }, [
    bpPerPx,
    region,
    selectedFeatureId,
    featureIdUnderMouse,
    contextMenuFeature,
    blockKey,
    blockLayoutFeatures,
  ])

  function onMouseDown(event: MouseEvent) {
    setMouseIsDown(true)
    setMovedDuringLastMouseDown(false)
    callMouseHandler('MouseDown', event)
  }

  function onMouseEnter(event: MouseEvent) {
    callMouseHandler('MouseEnter', event)
  }

  function onMouseOut(event: MouseEvent) {
    callMouseHandler('MouseOut', event)
    callMouseHandler('MouseLeave', event)
  }

  function onMouseOver(event: MouseEvent) {
    callMouseHandler('MouseOver', event)
  }

  function onMouseUp(event: MouseEvent) {
    setMouseIsDown(false)
    callMouseHandler('MouseUp', event)
  }

  function onClick(event: MouseEvent) {
    if (!movedDuringLastMouseDown) {
      callMouseHandler('Click', event)
    }
  }

  function onMouseLeave(event: MouseEvent) {
    callMouseHandler('MouseOut', event)
    callMouseHandler('MouseLeave', event)
  }

  function onContextMenu(event: MouseEvent) {
    callMouseHandler('ContextMenu', event)
  }

  function mouseMove(event: MouseEvent) {
    if (mouseIsDown) {
      setMovedDuringLastMouseDown(true)
    }
    let offsetX = 0
    let offsetY = 0
    if (highlightOverlayCanvas.current) {
      offsetX = highlightOverlayCanvas.current.getBoundingClientRect().left
      offsetY = highlightOverlayCanvas.current.getBoundingClientRect().top
    }
    offsetX = event.clientX - offsetX
    offsetY = event.clientY - offsetY
    const px = region.reversed ? width - offsetX : offsetX
    const clientBp = region.start + bpPerPx * px

    const featIdUnderMouse = displayModel.getFeatureOverlapping(
      blockKey,
      clientBp,
      offsetY,
    )

    if (onMouseMove) {
      onMouseMove(event, featIdUnderMouse)
    }
  }

  function callMouseHandler(handlerName: string, event: MouseEvent) {
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
  // need to call this in render so we get the right observer behavior
  return (
    <div
      className="PileupRendering"
      data-testid={`pileup-${
        sortedBy || colorBy
          ? `${sortedBy?.type || ''}${colorBy?.type || ''}${colorBy?.tag || ''}`
          : 'normal'
      }`}
      style={{ position: 'relative', width: canvasWidth, height }}
    >
      <PrerenderedCanvas
        {...props}
        style={{ position: 'absolute', left: 0, top: 0 }}
      />
      <canvas
        data-testid="pileup_overlay_canvas"
        width={canvasWidth}
        height={height}
        style={{ position: 'absolute', left: 0, top: 0 }}
        className="highlightOverlayCanvas"
        ref={highlightOverlayCanvas}
        onMouseDown={event => onMouseDown(event)}
        onMouseEnter={event => onMouseEnter(event)}
        onMouseOut={event => onMouseOut(event)}
        onMouseOver={event => onMouseOver(event)}
        onMouseUp={event => onMouseUp(event)}
        onMouseLeave={event => onMouseLeave(event)}
        onMouseMove={event => mouseMove(event)}
        onClick={event => onClick(event)}
        onContextMenu={event => onContextMenu(event)}
        onFocus={() => {}}
        onBlur={() => {}}
      />
    </div>
  )
}

export default observer(PileupRendering)
