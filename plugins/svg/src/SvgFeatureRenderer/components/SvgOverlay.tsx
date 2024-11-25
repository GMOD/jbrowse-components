import React, { useEffect, useState } from 'react'
import { bpSpanPx } from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import type { Feature, Region } from '@jbrowse/core/util'

type LayoutRecord = [number, number, number, number]

interface OverlayRectProps extends React.SVGProps<SVGRectElement> {
  rect?: LayoutRecord
  region: Region
  bpPerPx: number
}

function OverlayRect({
  rect,
  region,
  bpPerPx,
  ...rectProps
}: OverlayRectProps) {
  if (!rect) {
    return null
  }
  const [leftBp, topPx, rightBp, bottomPx] = rect
  const [leftPx, rightPx] = bpSpanPx(leftBp, rightBp, region, bpPerPx)
  const rectTop = Math.round(topPx)
  const screenWidth = (region.end - region.start) / bpPerPx
  const rectHeight = Math.round(bottomPx - topPx)
  const width = rightPx - leftPx

  if (leftPx + width < 0) {
    return null
  }
  const leftWithinBlock = Math.max(leftPx, 0)
  const diff = leftWithinBlock - leftPx
  const widthWithinBlock = Math.max(1, Math.min(width - diff, screenWidth))

  return (
    <rect
      x={leftWithinBlock - 2}
      y={rectTop - 2}
      width={widthWithinBlock + 4}
      height={rectHeight + 4}
      {...rectProps}
    />
  )
}

type ME = React.MouseEvent<SVGRectElement>
type MEFE = ME | React.FocusEvent<SVGRectElement>

const SvgOverlay = observer(function ({
  displayModel = {},
  blockKey,
  region,
  bpPerPx,
  movedDuringLastMouseDown,
  ...handlers
}: {
  region: Region
  displayModel?: {
    getFeatureByID?: (arg0: string, arg1: string) => LayoutRecord
    selectedFeatureId?: string
    featureIdUnderMouse?: string
    contextMenuFeature?: Feature
  }
  bpPerPx: number
  blockKey: string
  movedDuringLastMouseDown?: boolean
  onFeatureMouseDown?(event: ME, featureId: string): void
  onFeatureMouseEnter?(event: ME, featureId: string): void
  onFeatureMouseOut?(event: MEFE, featureId: string): void
  onFeatureMouseOver?(event: MEFE, featureId: string): void
  onFeatureMouseUp?(event: ME, featureId: string): void
  onFeatureMouseLeave?(event: ME, featureId: string): void
  onFeatureMouseMove?(event: ME, featureId: string): void
  // synthesized from mouseup and mousedown
  onFeatureClick?(event: ME, featureId: string): void
  onFeatureContextMenu?(event: ME, featureId: string): void
}) {
  const { selectedFeatureId, featureIdUnderMouse, contextMenuFeature } =
    displayModel

  const mouseoverFeatureId = featureIdUnderMouse || contextMenuFeature?.id()
  const [renderOverlay, setRenderOverlay] = useState(false)
  useEffect(() => {
    setRenderOverlay(true)
  }, [])

  function onFeatureMouseDown(event: ME) {
    const { onFeatureMouseDown: handler } = handlers
    if (!(handler && mouseoverFeatureId)) {
      return undefined
    }
    handler(event, mouseoverFeatureId)
  }

  function onFeatureMouseEnter(event: ME) {
    const { onFeatureMouseEnter: handler } = handlers
    if (!(handler && mouseoverFeatureId)) {
      return undefined
    }
    handler(event, mouseoverFeatureId)
  }

  function onFeatureMouseOut(event: ME | React.FocusEvent<SVGRectElement>) {
    const { onFeatureMouseOut: handler } = handlers
    if (!(handler && mouseoverFeatureId)) {
      return undefined
    }
    handler(event, mouseoverFeatureId)
  }

  function onFeatureMouseOver(event: ME | React.FocusEvent<SVGRectElement>) {
    const { onFeatureMouseOver: handler } = handlers
    if (!(handler && mouseoverFeatureId)) {
      return undefined
    }
    handler(event, mouseoverFeatureId)
  }

  function onFeatureMouseUp(event: ME) {
    const { onFeatureMouseUp: handler } = handlers
    if (!(handler && mouseoverFeatureId)) {
      return undefined
    }
    handler(event, mouseoverFeatureId)
  }

  function onFeatureMouseLeave(event: ME) {
    const { onFeatureMouseLeave: handler } = handlers
    if (!(handler && mouseoverFeatureId)) {
      return undefined
    }
    handler(event, mouseoverFeatureId)
  }

  function onFeatureMouseMove(event: ME) {
    const { onFeatureMouseMove: handler } = handlers
    if (!(handler && mouseoverFeatureId)) {
      return undefined
    }
    handler(event, mouseoverFeatureId)
  }

  function onFeatureClick(event: ME) {
    if (movedDuringLastMouseDown) {
      return undefined
    }
    const { onFeatureClick: handler } = handlers
    if (!(handler && mouseoverFeatureId)) {
      return undefined
    }
    event.stopPropagation()
    handler(event, mouseoverFeatureId)
  }

  function onFeatureContextMenu(event: ME) {
    const { onFeatureContextMenu: handler } = handlers
    if (!(handler && mouseoverFeatureId)) {
      return undefined
    }
    handler(event, mouseoverFeatureId)
  }

  return renderOverlay ? (
    <>
      {mouseoverFeatureId ? (
        <OverlayRect
          rect={displayModel.getFeatureByID?.(blockKey, mouseoverFeatureId)}
          region={region}
          bpPerPx={bpPerPx}
          fill="#000"
          fillOpacity="0.2"
          onMouseDown={onFeatureMouseDown}
          onMouseEnter={onFeatureMouseEnter}
          onMouseOut={onFeatureMouseOut}
          onMouseOver={onFeatureMouseOver}
          onMouseUp={onFeatureMouseUp}
          onMouseLeave={onFeatureMouseLeave}
          onMouseMove={onFeatureMouseMove}
          onClick={onFeatureClick}
          onContextMenu={onFeatureContextMenu}
          onFocus={onFeatureMouseOver}
          onBlur={onFeatureMouseOut}
          data-testid={mouseoverFeatureId}
        />
      ) : null}
      {selectedFeatureId ? (
        <OverlayRect
          rect={displayModel.getFeatureByID?.(blockKey, selectedFeatureId)}
          region={region}
          bpPerPx={bpPerPx}
          stroke="#00b8ff"
          fill="none"
        />
      ) : null}
    </>
  ) : null
})

export default SvgOverlay
