import { useEffect, useState } from 'react'

import { bpSpanPx } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import type { Feature, Region } from '@jbrowse/core/util'

type LayoutRecord = [number, number, number, number]
type ME = React.MouseEvent<SVGRectElement>
type MEFE = ME | React.FocusEvent<SVGRectElement>

function OverlayRect({
  rect,
  region,
  bpPerPx,
  ...rectProps
}: {
  rect?: LayoutRecord
  region: Region
  bpPerPx: number
} & React.SVGProps<SVGRectElement>) {
  if (!rect) {
    return null
  }

  const [leftBp, topPx, rightBp, bottomPx] = rect
  const [leftPx, rightPx] = bpSpanPx(leftBp, rightBp, region, bpPerPx)
  const width = rightPx - leftPx

  if (leftPx + width < 0) {
    return null
  }

  const screenWidth = (region.end - region.start) / bpPerPx
  const leftWithinBlock = Math.max(leftPx, 0)
  const widthWithinBlock = Math.max(1, Math.min(width - (leftWithinBlock - leftPx), screenWidth))

  return (
    <rect
      x={leftWithinBlock - 2}
      y={Math.round(topPx) - 2}
      width={widthWithinBlock + 4}
      height={Math.round(bottomPx - topPx) + 4}
      {...rectProps}
    />
  )
}

interface FeatureHandlers {
  onFeatureMouseDown?(event: ME, featureId: string): void
  onFeatureMouseEnter?(event: ME, featureId: string): void
  onFeatureMouseOut?(event: MEFE, featureId: string): void
  onFeatureMouseOver?(event: MEFE, featureId: string): void
  onFeatureMouseUp?(event: ME, featureId: string): void
  onFeatureMouseLeave?(event: ME, featureId: string): void
  onFeatureMouseMove?(event: ME, featureId: string): void
  onFeatureClick?(event: ME, featureId: string): void
  onFeatureContextMenu?(event: ME, featureId: string): void
}

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
} & FeatureHandlers) {
  const { selectedFeatureId, featureIdUnderMouse, contextMenuFeature } = displayModel
  const mouseoverFeatureId = featureIdUnderMouse || contextMenuFeature?.id()
  const [renderOverlay, setRenderOverlay] = useState(false)

  useEffect(() => {
    setRenderOverlay(true)
  }, [])

  const makeHandler =
    <T extends MEFE>(handlerName: keyof FeatureHandlers) =>
    (event: T) => {
      const handler = handlers[handlerName]
      if (handler && mouseoverFeatureId) {
        handler(event as ME, mouseoverFeatureId)
      }
    }

  const handleClick = (event: ME) => {
    if (!movedDuringLastMouseDown && handlers.onFeatureClick && mouseoverFeatureId) {
      event.stopPropagation()
      handlers.onFeatureClick(event, mouseoverFeatureId)
    }
  }

  if (!renderOverlay) {
    return null
  }

  return (
    <>
      {mouseoverFeatureId ? (
        <OverlayRect
          rect={displayModel.getFeatureByID?.(blockKey, mouseoverFeatureId)}
          region={region}
          bpPerPx={bpPerPx}
          fill="#000"
          fillOpacity="0.2"
          onMouseDown={makeHandler('onFeatureMouseDown')}
          onMouseEnter={makeHandler('onFeatureMouseEnter')}
          onMouseOut={makeHandler('onFeatureMouseOut')}
          onMouseOver={makeHandler('onFeatureMouseOver')}
          onMouseUp={makeHandler('onFeatureMouseUp')}
          onMouseLeave={makeHandler('onFeatureMouseLeave')}
          onMouseMove={makeHandler('onFeatureMouseMove')}
          onClick={handleClick}
          onContextMenu={makeHandler('onFeatureContextMenu')}
          onFocus={makeHandler('onFeatureMouseOver')}
          onBlur={makeHandler('onFeatureMouseOut')}
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
  )
})

export default SvgOverlay
