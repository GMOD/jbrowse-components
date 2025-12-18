import { useMemo, useRef, useState } from 'react'

import { PrerenderedCanvas } from '@jbrowse/core/ui'
import {
  getContainingTrack,
  getContainingView,
  getSession,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import { observer } from 'mobx-react'

import { flatbushItemToFeatureData, getFlatbushItemLabel } from '../types'

import type { ColorBy, FilterBy, SortedBy } from '../../shared/types'
import type { FlatbushItem } from '../types'
import type { Region } from '@jbrowse/core/util/types'
import type { BaseLinearDisplayModel } from '@jbrowse/plugin-linear-genome-view'

const PileupRendering = observer(function (props: {
  blockKey: string
  displayModel: BaseLinearDisplayModel
  width: number
  height: number
  regions: Region[]
  bpPerPx: number
  sortedBy?: SortedBy
  colorBy?: ColorBy
  filterBy?: FilterBy
  items: FlatbushItem[]
  flatbush: ArrayBufferLike
  featureNames?: Record<string, string>
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
    sortedBy,
    colorBy,
    filterBy,
    flatbush,
    items,
    featureNames = {},
    onFeatureClick,
    onFeatureContextMenu,
    onContextMenu,
  } = props
  const { refName } = regions[0]!
  const flatbush2 = useMemo(() => Flatbush.from(flatbush), [flatbush])
  const { selectedFeatureId, featureIdUnderMouse, contextMenuFeature } =
    displayModel

  const region = regions[0]!
  const ref = useRef<HTMLDivElement>(null)
  const [mouseIsDown, setMouseIsDown] = useState(false)
  const [movedDuringLastMouseDown, setMovedDuringLastMouseDown] =
    useState(false)
  const [itemUnderMouse, setItemUnderMouse] = useState<FlatbushItem>()
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
    const leftPx = region.reversed
      ? (region.end - rightBp) / bpPerPx
      : (leftBp - region.start) / bpPerPx
    const rightPx = region.reversed
      ? (region.end - leftBp) / bpPerPx
      : (rightBp - region.start) / bpPerPx
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
  const isClickable = itemUnderMouse || featureIdUnderMouse
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
      style={{
        position: 'relative',
        width: canvasWidth,
        height,
        cursor: isClickable ? 'pointer' : 'default',
      }}
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
        const offsetY = event.clientY - rect.top
        const px = region.reversed ? width - offsetX : offsetX
        const clientBp = region.start + bpPerPx * px
        const search = flatbush2.search(
          offsetX,
          offsetY,
          offsetX + 1,
          offsetY + 1,
        )
        const item = search.length ? items[search[0]!] : undefined
        setItemUnderMouse(item)
        const featureId = displayModel.getFeatureOverlapping(
          blockKey,
          clientBp,
          offsetY,
        )
        const label =
          (item ? getFlatbushItemLabel(item) : undefined) ??
          (featureId ? featureNames[featureId] : undefined)
        onMouseMove?.(event, featureId, label)
      }}
      onClick={event => {
        if (!movedDuringLastMouseDown) {
          if (itemUnderMouse) {
            const session = getSession(displayModel)
            const view = getContainingView(displayModel)
            const sourceRead = featureIdUnderMouse
              ? featureNames[featureIdUnderMouse]
              : undefined
            const featureData = flatbushItemToFeatureData(
              itemUnderMouse,
              refName,
              sourceRead,
            )
            if (isSessionModelWithWidgets(session)) {
              const featureWidget = session.addWidget(
                'BaseFeatureWidget',
                'baseFeature',
                {
                  featureData,
                  view,
                  track: getContainingTrack(displayModel),
                },
              )
              session.showWidget(featureWidget)
            }
          } else if (onFeatureClick && featureIdUnderMouse) {
            onFeatureClick(event, featureIdUnderMouse)
          }
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

export default PileupRendering
