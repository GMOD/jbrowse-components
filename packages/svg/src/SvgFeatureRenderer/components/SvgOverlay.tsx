import { bpSpanPx } from '@gmod/jbrowse-core/util'
import SimpleFeature from '@gmod/jbrowse-core/util/simpleFeature'
import { Region } from '@gmod/jbrowse-core/util/types'
import { observer } from 'mobx-react'
import React from 'react'

type LayoutRecord = [number, number, number, number]
interface SvgOverlayProps {
  region: Region
  trackModel: {
    blockLayoutFeatures: Map<string, Map<string, LayoutRecord>>
    selectedFeatureId?: string
    featureIdUnderMouse?: string
    contextMenuFeature?: SimpleFeature
  }
  bpPerPx: number
  blockKey: string
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
      style={{ pointerEvents: 'none' }}
      x={leftWithinBlock - 2}
      y={rectTop - 2}
      width={widthWithinBlock + 4}
      height={rectHeight + 4}
      {...rectProps}
    />
  )
}

function SvgOverlay({
  trackModel: {
    blockLayoutFeatures,
    selectedFeatureId,
    featureIdUnderMouse,
    contextMenuFeature,
  },
  blockKey,
  region,
  bpPerPx,
}: SvgOverlayProps) {
  if (blockLayoutFeatures) {
    const blockLayout = blockLayoutFeatures.get(blockKey)
    if (blockLayout) {
      const mouseoverFeatureId = featureIdUnderMouse || contextMenuFeature?.id()
      return (
        <>
          {mouseoverFeatureId ? (
            <OverlayRect
              rect={blockLayout.get(mouseoverFeatureId)}
              region={region}
              bpPerPx={bpPerPx}
              fill="#000"
              fillOpacity="0.2"
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
  }
  return null
}

export default observer(SvgOverlay)
