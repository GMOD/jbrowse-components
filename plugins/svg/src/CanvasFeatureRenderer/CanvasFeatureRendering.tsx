import { useMemo, useRef, useState } from 'react'

import { PrerenderedCanvas } from '@jbrowse/core/ui'
import { bpSpanPx } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import { observer } from 'mobx-react'

import type { FlatbushItem } from './types'
import type { Region } from '@jbrowse/core/util/types'
import type { BaseLinearDisplayModel } from '@jbrowse/plugin-linear-genome-view'

const CanvasFeatureRendering = observer(function (props: {
  blockKey: string
  displayModel: BaseLinearDisplayModel
  width: number
  height: number
  regions: Region[]
  bpPerPx: number
  items: FlatbushItem[]
  flatbush: any
  onMouseMove?: (
    event: React.MouseEvent,
    featureId?: string,
    extra?: string,
  ) => void
  onMouseLeave?: (event: React.MouseEvent) => void
  onFeatureClick?: (event: React.MouseEvent, featureId: string) => void
  onFeatureContextMenu?: (event: React.MouseEvent, featureId: string) => void
  onContextMenu?: (event: React.MouseEvent) => void
}) {
  const {
    onMouseMove,
    onMouseLeave,
    blockKey,
    displayModel,
    width,
    height,
    regions,
    bpPerPx,
    flatbush,
    items,
    onFeatureClick,
    onFeatureContextMenu,
    onContextMenu,
  } = props
  const flatbush2 = useMemo(() => Flatbush.from(flatbush), [flatbush])
  const { selectedFeatureId, featureIdUnderMouse, contextMenuFeature } =
    displayModel

  const region = regions[0]!
  const ref = useRef<HTMLDivElement>(null)
  const [mouseIsDown, setMouseIsDown] = useState(false)
  const [movedDuringLastMouseDown, setMovedDuringLastMouseDown] =
    useState(false)
  const selectedRect = selectedFeatureId
    ? displayModel.getFeatureByID(blockKey, selectedFeatureId)
    : undefined

  const highlightedFeature = featureIdUnderMouse || contextMenuFeature?.id()
  const highlightedRect = highlightedFeature
    ? displayModel.getFeatureByID(blockKey, highlightedFeature)
    : undefined

  function makeRect(
    r: [number, number, number, number] | [number, number, number, number, any],
    offset = 2,
  ) {
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

  const canvasWidth = Math.ceil(width)
  return (
    <div
      ref={ref}
      data-testid="canvas-feature-overlay"
      style={{ position: 'relative', width: canvasWidth, height }}
      onMouseLeave={onMouseLeave}
      onMouseDown={(_event: React.MouseEvent) => {
        setMouseIsDown(true)
        setMovedDuringLastMouseDown(false)
      }}
      onMouseUp={() => {
        setMouseIsDown(false)
      }}
      onMouseMove={event => {
        if (!ref.current) {
          return
        }
        if (mouseIsDown) {
          setMovedDuringLastMouseDown(true)
        }
        const rect = ref.current.getBoundingClientRect()
        const offsetX = event.clientX - rect.left
        // Account for vertical scrolling in the track
        const scrollTop = ref.current.parentElement?.scrollTop || 0
        const offsetY = event.clientY - rect.top + scrollTop
        const search = flatbush2.search(
          offsetX,
          offsetY,
          offsetX + 1,
          offsetY + 1,
        )
        const item = search.length ? items[search[0]!] : undefined
        const featureId = item?.featureId
        onMouseMove?.(event, featureId)
      }}
      onClick={event => {
        if (
          !movedDuringLastMouseDown &&
          onFeatureClick &&
          featureIdUnderMouse
        ) {
          onFeatureClick(event, featureIdUnderMouse)
        }
      }}
      onContextMenu={event => {
        if (onFeatureContextMenu && featureIdUnderMouse) {
          onFeatureContextMenu(event, featureIdUnderMouse)
        } else {
          onContextMenu?.(event)
        }
      }}
    >
      <PrerenderedCanvas
        {...props}
        style={{ position: 'absolute', left: 0, top: 0 }}
      />
      {highlight ? (
        <div
          style={{
            position: 'absolute',
            backgroundColor: '#0003',
            pointerEvents: 'none',
            ...highlight,
          }}
        />
      ) : null}
      {selected ? (
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

export default CanvasFeatureRendering
