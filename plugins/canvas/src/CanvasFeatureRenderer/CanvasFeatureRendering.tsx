import { useMemo, useRef, useState } from 'react'

import { PrerenderedCanvas } from '@jbrowse/core/ui'
import Flatbush from '@jbrowse/core/util/flatbush'
import { observer } from 'mobx-react'

import type { FlatbushItem, SubfeatureInfo } from './types'
import type { Region } from '@jbrowse/core/util/types'
import type { BaseLinearDisplayModel } from '@jbrowse/plugin-linear-genome-view'

const CanvasFeatureRendering = observer(function CanvasFeatureRendering(props: {
  blockKey: string
  displayModel: BaseLinearDisplayModel
  width: number
  height: number
  regions: Region[]
  bpPerPx: number
  items: FlatbushItem[]
  flatbush: ArrayBufferLike
  subfeatureInfos?: SubfeatureInfo[]
  subfeatureFlatbush?: ArrayBufferLike
  onMouseMove?: (e: React.MouseEvent, featId?: string, extra?: string) => void
  onMouseLeave?: (e: React.MouseEvent) => void
  onFeatureClick?: (e: React.MouseEvent, featId: string) => void
  onFeatureContextMenu?: (e: React.MouseEvent, featId: string) => void
  onContextMenu?: (e: React.MouseEvent) => void
}) {
  const {
    onMouseMove,
    onMouseLeave,
    displayModel,
    width,
    height,
    flatbush,
    items,
    subfeatureFlatbush,
    subfeatureInfos = [],
    onFeatureClick,
    onFeatureContextMenu,
    onContextMenu,
  } = props
  const flatbush2 = useMemo(() => Flatbush.from(flatbush), [flatbush])
  const subfeatureFlatbush2 = useMemo(
    () => (subfeatureFlatbush ? Flatbush.from(subfeatureFlatbush) : null),
    [subfeatureFlatbush],
  )

  // Create efficient lookup map for items by feature ID
  const itemsById = useMemo(() => {
    const map = new Map<string, FlatbushItem>()
    for (const item of items) {
      map.set(item.featureId, item)
    }
    return map
  }, [items])

  const { selectedFeatureId, featureIdUnderMouse, contextMenuFeature } =
    displayModel

  const ref = useRef<HTMLDivElement>(null)
  const [mouseIsDown, setMouseIsDown] = useState(false)
  const [movedDuringLastMouseDown, setMovedDuringLastMouseDown] =
    useState(false)
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null)
  // For selected features, look up in items map (O(1) instead of O(n))
  const selectedItem = selectedFeatureId
    ? itemsById.get(selectedFeatureId)
    : undefined

  // For highlighted features, use the items map for O(1) lookup
  const highlightedFeature = featureIdUnderMouse || contextMenuFeature?.id()
  const highlightedItem = highlightedFeature
    ? itemsById.get(highlightedFeature)
    : undefined

  // Convert FlatbushItem to display rectangle
  function itemToRect(item: FlatbushItem, offset = 2) {
    // Use the stored pixel coordinates which include label extent
    const rectTop = Math.round(item.topPx)
    const rectHeight = Math.round(item.bottomPx - item.topPx)
    return {
      left: item.leftPx - offset,
      top: rectTop - offset,
      width: item.rightPx - item.leftPx,
      height: rectHeight,
    }
  }

  const selected = selectedItem ? itemToRect(selectedItem) : undefined
  const highlight = highlightedItem ? itemToRect(highlightedItem, 0) : undefined

  const canvasWidth = Math.ceil(width)
  return (
    <div
      ref={ref}
      data-testid="canvas-feature-overlay"
      style={{ position: 'relative', width: canvasWidth, height }}
      onMouseLeave={onMouseLeave}
      onMouseDown={(event: React.MouseEvent) => {
        setMouseIsDown(true)
        setMovedDuringLastMouseDown(false)
        if (ref.current) {
          const rect = ref.current.getBoundingClientRect()
          const scrollT = ref.current.scrollTop
          mouseDownPos.current = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top + scrollT,
          }
        }
      }}
      onMouseUp={() => {
        setMouseIsDown(false)
      }}
      onMouseMove={event => {
        if (!ref.current) {
          return
        }
        const rect = ref.current.getBoundingClientRect()
        const scrollT = ref.current.scrollTop
        const offsetX = event.clientX - rect.left
        const offsetY = event.clientY - rect.top + scrollT

        // Only set movedDuringLastMouseDown if mouse has moved more than 3px
        if (mouseIsDown && mouseDownPos.current) {
          const dx = offsetX - mouseDownPos.current.x
          const dy = offsetY - mouseDownPos.current.y
          const distance = Math.sqrt(dx * dx + dy * dy)
          if (distance > 3) {
            setMovedDuringLastMouseDown(true)
          }
        }

        // Search primary flatbush for feature to highlight
        const search = flatbush2.search(
          offsetX,
          offsetY,
          offsetX + 1,
          offsetY + 1,
        )
        const item = search.length ? items[search[0]!] : undefined
        const featureId = item?.featureId

        // Use pre-built tooltip, optionally append subfeature info
        let extra = item?.tooltip
        if (extra && subfeatureFlatbush2 && subfeatureInfos.length) {
          const subfeatureSearch = subfeatureFlatbush2.search(
            offsetX,
            offsetY,
            offsetX + 1,
            offsetY + 1,
          )
          if (subfeatureSearch.length) {
            const subfeatureInfo = subfeatureInfos[subfeatureSearch[0]!]
            if (subfeatureInfo) {
              const { name, type } = subfeatureInfo
              extra += `<br/>${name ? `${name} (${type})` : type}`
            }
          }
        }
        onMouseMove?.(event, featureId, extra)
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
            backgroundColor: '#00000033',
            pointerEvents: 'none',
            zIndex: 10,
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
