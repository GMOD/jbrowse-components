import { useCallback, useMemo, useRef, useState } from 'react'

import { PrerenderedCanvas } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
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
  onContextMenu?: (e: React.MouseEvent) => void
}) {
  const {
    displayModel,
    width,
    height,
    flatbush,
    items,
    subfeatureFlatbush,
    subfeatureInfos = [],
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

  const {
    selectedFeatureId,
    featureIdUnderMouse,
    subfeatureIdUnderMouse,
    contextMenuFeature,
  } = displayModel

  const ref = useRef<HTMLDivElement>(null)
  const [mouseIsDown, setMouseIsDown] = useState(false)
  const [movedDuringLastMouseDown, setMovedDuringLastMouseDown] =
    useState(false)
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null)

  // Create lookup map for subfeatureInfos by featureId
  const subfeatureInfosById = useMemo(() => {
    const map = new Map<string, SubfeatureInfo>()
    for (const info of subfeatureInfos) {
      map.set(info.featureId, info)
    }
    return map
  }, [subfeatureInfos])

  // Hit detection helper - finds feature/subfeature at given coordinates
  const getFeatureAtPosition = useCallback(
    (offsetX: number, offsetY: number) => {
      const search = flatbush2.search(
        offsetX,
        offsetY,
        offsetX + 1,
        offsetY + 1,
      )
      const item = search.length ? items[search[0]!] : undefined
      if (!item) {
        return {
          item: undefined,
          featureId: undefined,
          parentFeatureId: undefined,
        }
      }

      let featureId = item.featureId
      let parentFeatureId: string | undefined

      if (subfeatureFlatbush2 && subfeatureInfos.length) {
        const subSearch = subfeatureFlatbush2.search(
          offsetX,
          offsetY,
          offsetX + 1,
          offsetY + 1,
        )
        if (subSearch.length) {
          const info = subfeatureInfos[subSearch[0]!]
          if (info) {
            featureId = info.featureId
            parentFeatureId = info.parentFeatureId
          }
        }
      }
      return { item, featureId, parentFeatureId }
    },
    [flatbush2, items, subfeatureFlatbush2, subfeatureInfos],
  )

  // For selected features, check subfeatures first, then items
  const selectedSubfeature = selectedFeatureId
    ? subfeatureInfosById.get(selectedFeatureId)
    : undefined
  const selectedItem =
    selectedFeatureId && !selectedSubfeature
      ? itemsById.get(selectedFeatureId)
      : undefined

  // For highlighted features, use subfeature bounds if available
  const highlightedFeature = featureIdUnderMouse || contextMenuFeature?.id()
  const highlightedSubfeature = subfeatureIdUnderMouse
    ? subfeatureInfosById.get(subfeatureIdUnderMouse)
    : undefined
  const highlightedItem =
    highlightedFeature && !highlightedSubfeature
      ? itemsById.get(highlightedFeature)
      : undefined

  // Convert pixel bounds to display rectangle
  function boundsToRect(
    bounds: {
      leftPx: number
      topPx: number
      rightPx: number
      bottomPx: number
    },
    offset = 2,
  ) {
    const rectTop = Math.round(bounds.topPx)
    const rectHeight = Math.round(bounds.bottomPx - bounds.topPx)
    return {
      left: bounds.leftPx - offset,
      top: rectTop - offset,
      width: bounds.rightPx - bounds.leftPx,
      height: rectHeight,
    }
  }

  const selected = selectedSubfeature
    ? boundsToRect(selectedSubfeature)
    : selectedItem
      ? boundsToRect(selectedItem)
      : undefined
  const highlight = highlightedSubfeature
    ? boundsToRect(highlightedSubfeature, 0)
    : highlightedItem
      ? boundsToRect(highlightedItem, 0)
      : undefined

  const canvasWidth = Math.ceil(width)
  return (
    <div
      ref={ref}
      data-testid="canvas-feature-overlay"
      style={{
        position: 'relative',
        width: canvasWidth,
        height,
      }}
      onMouseLeave={() => {
        displayModel.setFeatureIdUnderMouse(undefined)
        displayModel.setSubfeatureIdUnderMouse(undefined)
        displayModel.setMouseoverExtraInformation(undefined)
      }}
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

        const { item, featureId, parentFeatureId } = getFeatureAtPosition(
          offsetX,
          offsetY,
        )

        // Build tooltip with subfeature info
        let extra = item?.tooltip
        if (extra && parentFeatureId) {
          const subInfo = subfeatureInfosById.get(featureId)
          if (subInfo) {
            const { displayLabel, type } = subInfo
            extra += `<br/>${displayLabel ? `${displayLabel} (${type})` : type}`
          }
        }

        displayModel.setFeatureIdUnderMouse(item?.featureId)
        displayModel.setSubfeatureIdUnderMouse(
          parentFeatureId ? featureId : undefined,
        )
        displayModel.setMouseoverExtraInformation(extra)
      }}
      onClick={event => {
        if (!movedDuringLastMouseDown && ref.current) {
          const rect = ref.current.getBoundingClientRect()
          const scrollT = ref.current.scrollTop
          const offsetX = event.clientX - rect.left
          const offsetY = event.clientY - rect.top + scrollT

          const { item, featureId, parentFeatureId } = getFeatureAtPosition(
            offsetX,
            offsetY,
          )
          if (item) {
            // Pass the top-level feature ID for RPC lookup since nested
            // subfeature parents may not be in the layout cache
            displayModel
              .selectFeatureById(featureId, parentFeatureId, item.featureId)
              .catch((e: unknown) => {
                console.error(e)
                getSession(displayModel).notifyError(`${e}`, e)
              })
          } else {
            displayModel.clearFeatureSelection()
          }
        }
      }}
      onContextMenu={event => {
        if (ref.current) {
          const rect = ref.current.getBoundingClientRect()
          const scrollT = ref.current.scrollTop
          const offsetX = event.clientX - rect.left
          const offsetY = event.clientY - rect.top + scrollT

          const { item, featureId, parentFeatureId } = getFeatureAtPosition(
            offsetX,
            offsetY,
          )
          if (item) {
            displayModel
              .setContextMenuFeatureById(
                featureId,
                parentFeatureId,
                item.featureId,
              )
              .catch((e: unknown) => {
                console.error(e)
                getSession(displayModel).notifyError(`${e}`, e)
              })
          } else {
            onContextMenu?.(event)
          }
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
