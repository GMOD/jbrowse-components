import { Region } from '@gmod/jbrowse-core/util/types'
import { PrerenderedCanvas } from '@gmod/jbrowse-core/ui'
import { bpSpanPx } from '@gmod/jbrowse-core/util'
import { observer } from 'mobx-react'
import React, { MouseEvent, useRef, useState, useEffect } from 'react'
import runner from 'mobx-run-in-reactive-context'
import { BlockBasedTrackModel } from '@gmod/jbrowse-plugin-linear-genome-view/src/BasicTrack/blockBasedTrackModel'

function PileupRendering(props: {
  blockKey: string
  trackModel: BlockBasedTrackModel
  width: number
  height: number
  regions: Region[]
  bpPerPx: number
  onMouseMove?: (event: React.MouseEvent, featureId: string | undefined) => void
}) {
  const {
    onMouseMove,
    blockKey,
    trackModel,
    width,
    height,
    regions,
    bpPerPx,
  } = props
  const { selectedFeatureId, featureIdUnderMouse, blockLayoutFeatures } =
    trackModel || {}
  const [region] = regions
  const highlightOverlayCanvas = useRef<HTMLCanvasElement>(null)
  const [mouseIsDown, setMouseIsDown] = useState(false)
  const [movedDuringLastMouseDown, setMovedDuringLastMouseDown] = useState(
    false,
  )
  useEffect(() => {
    const canvas = highlightOverlayCanvas.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
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
    if (
      featureIdUnderMouse &&
      (blockLayout = blockLayoutFeatures.get(blockKey)) &&
      (rect = blockLayout.get(featureIdUnderMouse))
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
      callMouseHandler('Click', event, true)
    }
  }

  function onMouseLeave(event: MouseEvent) {
    callMouseHandler('MouseOut', event)
    callMouseHandler('MouseLeave', event)
  }

  function onContextMenu(event: MouseEvent) {
    if (!movedDuringLastMouseDown) {
      callMouseHandler('ContextMenu', event)
    }
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

    const feats = trackModel.getFeatureOverlapping(blockKey, clientBp, offsetY)
    const featIdUnderMouse = feats.length ? feats[0].name : undefined
    trackModel.setFeatureIdUnderMouse(featIdUnderMouse)

    if (onMouseMove) {
      onMouseMove(event, featIdUnderMouse)
    }
  }

  function callMouseHandler(
    handlerName: string,
    event: MouseEvent,
    always = false,
  ) {
    // @ts-ignore
    const featureHandler = props[`onFeature${handlerName}`]
    // @ts-ignore
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
        data-testid="pileup_overlay_canvas"
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
        onMouseMove={event => runner(() => mouseMove(event))}
        onClick={event => runner(() => onClick(event))}
        onContextMenu={event => runner(() => onContextMenu(event))}
        onFocus={() => {}}
        onBlur={() => {}}
      />
    </div>
  )
}

export default observer(PileupRendering)
