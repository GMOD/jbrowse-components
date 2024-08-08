import React, { useRef, useState, useEffect } from 'react'
import { Region } from '@jbrowse/core/util/types'
import { PrerenderedCanvas } from '@jbrowse/core/ui'
import { bpSpanPx } from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import type { BaseLinearDisplayModel } from '@jbrowse/plugin-linear-genome-view'

const PileupRendering = observer(function (props: {
  blockKey: string
  displayModel: BaseLinearDisplayModel
  width: number
  height: number
  regions: Region[]
  bpPerPx: number
  sortedBy?: { type: string; pos: number; refName: string }
  colorBy?: { type: string; tag?: string }
  filterBy?: { tagFilter?: { tag: string } }
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
    displayModel

  const [region] = regions
  const [highlight, setHighlight] = useState<{
    left: number
    top: number
    width: number
    height: number
  }>()
  const [selected, setSelected] = useState<{
    left: number
    top: number
    width: number
    height: number
  }>()
  const ref = useRef<HTMLDivElement>(null)
  const [mouseIsDown, setMouseIsDown] = useState(false)
  const [movedDuringLastMouseDown, setMovedDuringLastMouseDown] =
    useState(false)
  useEffect(() => {
    const selectedRect = selectedFeatureId
      ? displayModel.getFeatureByID?.(blockKey, selectedFeatureId)
      : undefined
    if (selectedRect) {
      const [leftBp, topPx, rightBp, bottomPx] = selectedRect
      const [leftPx, rightPx] = bpSpanPx(leftBp, rightBp, region, bpPerPx)
      const rectTop = Math.round(topPx)
      const rectHeight = Math.round(bottomPx - topPx)
      setSelected({
        left: leftPx - 2,
        top: rectTop - 2,
        width: rightPx - leftPx + 4,
        height: rectHeight + 4,
      })
    }
    const highlightedFeature = featureIdUnderMouse || contextMenuFeature?.id()
    const highlightedRect = highlightedFeature
      ? displayModel.getFeatureByID?.(blockKey, highlightedFeature)
      : undefined
    if (highlightedRect) {
      const [leftBp, topPx, rightBp, bottomPx] = highlightedRect
      const [leftPx, rightPx] = bpSpanPx(leftBp, rightBp, region, bpPerPx)
      const rectTop = Math.round(topPx)
      const rectHeight = Math.round(bottomPx - topPx)
      setHighlight({
        left: leftPx,
        top: rectTop,
        width: rightPx - leftPx,
        height: rectHeight,
      })
    } else {
      setHighlight(undefined)
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
      displayModel.getFeatureOverlapping(blockKey, clientBp, offsetY),
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
        'pileup',
        sortedBy?.type,
        colorBy?.type,
        colorBy?.tag,
        filterBy?.tagFilter?.tag,
      ]
        .filter(f => !!f)
        .join('-')}
      style={{ position: 'relative', width: canvasWidth, height }}
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
    >
      <PrerenderedCanvas
        {...props}
        style={{ position: 'absolute', left: 0, top: 0 }}
      />
      {highlight ? (
        <div
          style={{
            position: 'absolute',
            ...highlight,
            backgroundColor: '#0003',
          }}
        />
      ) : null}
      {selected ? (
        <div
          style={{
            position: 'absolute',
            ...selected,
            border: '1px solid #00b8ff',
          }}
        />
      ) : null}
    </div>
  )
})

export default PileupRendering
