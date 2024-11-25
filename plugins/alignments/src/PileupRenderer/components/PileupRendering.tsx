import React, { useRef, useState, useEffect } from 'react'
import { PrerenderedCanvas } from '@jbrowse/core/ui'
import { bpSpanPx } from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import type { Region } from '@jbrowse/core/util/types'
import type { BaseLinearDisplayModel } from '@jbrowse/plugin-linear-genome-view'

const PileupRendering = observer(function (props: {
  blockKey: string
  displayModel?: BaseLinearDisplayModel
  width: number
  height: number
  regions: Region[]
  bpPerPx: number
  sortedBy?: {
    type: string
    pos: number
    refName: string
  }
  colorBy?: {
    type: string
    tag?: string
  }
  filterBy?: {
    tagFilter?: { tag: string }
  }
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
    sortedBy,
    colorBy,
    filterBy,
  } = props
  const { selectedFeatureId, featureIdUnderMouse, contextMenuFeature } =
    displayModel || {}
  const [firstRender, setFirstRender] = useState(false)
  useEffect(() => {
    setFirstRender(true)
  }, [])

  const region = regions[0]!
  const ref = useRef<HTMLDivElement>(null)
  const [mouseIsDown, setMouseIsDown] = useState(false)
  const [movedDuringLastMouseDown, setMovedDuringLastMouseDown] =
    useState(false)
  const selectedRect = selectedFeatureId
    ? displayModel?.getFeatureByID(blockKey, selectedFeatureId)
    : undefined

  const highlightedFeature = featureIdUnderMouse || contextMenuFeature?.id()
  const highlightedRect = highlightedFeature
    ? displayModel?.getFeatureByID(blockKey, highlightedFeature)
    : undefined

  function makeRect(r: [number, number, number, number], offset = 2) {
    const [leftBp, topPx, rightBp, bottomPx] = r
    const [leftPx, rightPx] = bpSpanPx(leftBp, rightBp, region, bpPerPx)
    const rectTop = Math.round(topPx)
    const rectHeight = Math.round(bottomPx - topPx)
    return {
      left: leftPx - offset,
      top: rectTop - offset,
      width: rightPx - leftPx,
      height: rectHeight,
    }
  }
  const selected = selectedRect ? makeRect(selectedRect) : undefined
  const highlight = highlightedRect ? makeRect(highlightedRect, 0) : undefined

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
    if (!ref.current) {
      return
    }
    if (mouseIsDown) {
      setMovedDuringLastMouseDown(true)
    }
    const rect = ref.current.getBoundingClientRect()
    const offsetX = event.clientX - rect.left
    const offsetY = event.clientY - rect.top
    const px = region.reversed ? width - offsetX : offsetX
    const clientBp = region.start + bpPerPx * px

    onMouseMove?.(
      event,
      displayModel?.getFeatureOverlapping(blockKey, clientBp, offsetY),
    )
  }

  function callMouseHandler(handlerName: string, event: React.MouseEvent) {
    // @ts-expect-error
    const featureHandler = props[`onFeature${handlerName}`]
    // @ts-expect-error
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
      ref={ref}
      data-testid={[
        'pileup-overlay',
        sortedBy?.type,
        colorBy?.type,
        colorBy?.tag,
        filterBy?.tagFilter?.tag,
      ]
        .filter(f => !!f)
        .join('-')}
      style={{ position: 'relative', width: canvasWidth, height }}
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
    >
      <PrerenderedCanvas
        {...props}
        style={{ position: 'absolute', left: 0, top: 0 }}
      />
      {firstRender && highlight ? (
        <div
          style={{
            position: 'absolute',
            backgroundColor: '#0003',
            pointerEvents: 'none',
            ...highlight,
          }}
        />
      ) : null}
      {firstRender && selected ? (
        <div
          style={{
            position: 'absolute',
            border: '2px solid #00b8ff',
            boxSizing: 'content-box',
            pointerEvents: 'none',
            ...selected,
          }}
        />
      ) : null}
    </div>
  )
})

export default PileupRendering
