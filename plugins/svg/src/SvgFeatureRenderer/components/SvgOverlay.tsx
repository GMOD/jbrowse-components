import { bpSpanPx } from '@jbrowse/core/util'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { Region } from '@jbrowse/core/util/types'
import { observer } from 'mobx-react'
import React from 'react'

type LayoutRecord = [number, number, number, number]
interface SvgOverlayProps {
  region: Region
  displayModel: {
    blockLayoutFeatures: Map<string, Map<string, LayoutRecord>>
    selectedFeatureId?: string
    featureIdUnderMouse?: string
    contextMenuFeature?: SimpleFeature
  }
  bpPerPx: number
  blockKey: string
  movedDuringLastMouseDown: boolean
  onFeatureMouseDown?(
    event: React.MouseEvent<SVGRectElement, MouseEvent>,
    featureId: string,
  ): {}
  onFeatureMouseEnter?(
    event: React.MouseEvent<SVGRectElement, MouseEvent>,
    featureId: string,
  ): {}
  onFeatureMouseOut?(
    event:
      | React.MouseEvent<SVGRectElement, MouseEvent>
      | React.FocusEvent<SVGRectElement>,
    featureId: string,
  ): {}
  onFeatureMouseOver?(
    event:
      | React.MouseEvent<SVGRectElement, MouseEvent>
      | React.FocusEvent<SVGRectElement>,
    featureId: string,
  ): {}
  onFeatureMouseUp?(
    event: React.MouseEvent<SVGRectElement, MouseEvent>,
    featureId: string,
  ): {}
  onFeatureMouseLeave?(
    event: React.MouseEvent<SVGRectElement, MouseEvent>,
    featureId: string,
  ): {}
  onFeatureMouseMove?(
    event: React.MouseEvent<SVGRectElement, MouseEvent>,
    featureId: string,
  ): {}
  // synthesized from mouseup and mousedown
  onFeatureClick?(
    event: React.MouseEvent<SVGRectElement, MouseEvent>,
    featureId: string,
  ): {}
  onFeatureContextMenu?(
    event: React.MouseEvent<SVGRectElement, MouseEvent>,
    featureId: string,
  ): {}
}

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

function SvgOverlay({
  displayModel: {
    blockLayoutFeatures,
    selectedFeatureId,
    featureIdUnderMouse,
    contextMenuFeature,
  },
  blockKey,
  region,
  bpPerPx,
  movedDuringLastMouseDown,
  ...handlers
}: SvgOverlayProps) {
  const blockLayout = blockLayoutFeatures?.get(blockKey)
  if (!blockLayout) {
    return null
  }
  const mouseoverFeatureId = featureIdUnderMouse || contextMenuFeature?.id()

  function onFeatureMouseDown(
    event: React.MouseEvent<SVGRectElement, MouseEvent>,
  ) {
    const { onFeatureMouseDown: handler } = handlers
    if (!(handler && mouseoverFeatureId)) {
      return undefined
    }
    return handler(event, mouseoverFeatureId)
  }

  function onFeatureMouseEnter(
    event: React.MouseEvent<SVGRectElement, MouseEvent>,
  ) {
    const { onFeatureMouseEnter: handler } = handlers
    if (!(handler && mouseoverFeatureId)) {
      return undefined
    }
    return handler(event, mouseoverFeatureId)
  }

  function onFeatureMouseOut(
    event:
      | React.MouseEvent<SVGRectElement, MouseEvent>
      | React.FocusEvent<SVGRectElement>,
  ) {
    const { onFeatureMouseOut: handler } = handlers
    if (!(handler && mouseoverFeatureId)) {
      return undefined
    }
    return handler(event, mouseoverFeatureId)
  }

  function onFeatureMouseOver(
    event:
      | React.MouseEvent<SVGRectElement, MouseEvent>
      | React.FocusEvent<SVGRectElement>,
  ) {
    const { onFeatureMouseOver: handler } = handlers
    if (!(handler && mouseoverFeatureId)) {
      return undefined
    }
    return handler(event, mouseoverFeatureId)
  }

  function onFeatureMouseUp(
    event: React.MouseEvent<SVGRectElement, MouseEvent>,
  ) {
    const { onFeatureMouseUp: handler } = handlers
    if (!(handler && mouseoverFeatureId)) {
      return undefined
    }
    return handler(event, mouseoverFeatureId)
  }

  function onFeatureMouseLeave(
    event: React.MouseEvent<SVGRectElement, MouseEvent>,
  ) {
    const { onFeatureMouseLeave: handler } = handlers
    if (!(handler && mouseoverFeatureId)) {
      return undefined
    }
    return handler(event, mouseoverFeatureId)
  }

  function onFeatureMouseMove(
    event: React.MouseEvent<SVGRectElement, MouseEvent>,
  ) {
    const { onFeatureMouseMove: handler } = handlers
    if (!(handler && mouseoverFeatureId)) {
      return undefined
    }
    return handler(event, mouseoverFeatureId)
  }

  function onFeatureClick(event: React.MouseEvent<SVGRectElement, MouseEvent>) {
    if (movedDuringLastMouseDown) {
      return undefined
    }
    const { onFeatureClick: handler } = handlers
    if (!(handler && mouseoverFeatureId)) {
      return undefined
    }
    event.stopPropagation()
    return handler(event, mouseoverFeatureId)
  }

  function onFeatureContextMenu(
    event: React.MouseEvent<SVGRectElement, MouseEvent>,
  ) {
    const { onFeatureContextMenu: handler } = handlers
    if (!(handler && mouseoverFeatureId)) {
      return undefined
    }
    return handler(event, mouseoverFeatureId)
  }

  return (
    <>
      {mouseoverFeatureId ? (
        <OverlayRect
          rect={blockLayout.get(mouseoverFeatureId)}
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
          rect={blockLayout.get(selectedFeatureId)}
          region={region}
          bpPerPx={bpPerPx}
          stroke="#00b8ff"
          fill="none"
        />
      ) : null}
    </>
  )
}

export default observer(SvgOverlay)
