import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ErrorOverlay, Menu } from '@jbrowse/core/ui'
import { getContainingView, useGpuModelLifecycle } from '@jbrowse/core/util'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import { CanvasFeatureRenderer } from './CanvasFeatureRenderer.ts'
import FeatureTooltip from './FeatureTooltip.tsx'
import OverflowIndicator from './OverflowIndicator.tsx'
import { performMultiRegionHitDetection } from './hitTesting.ts'
import {
  useAminoAcidOverlay,
  useFloatingLabels,
  useHighlightOverlays,
} from './useOverlayElements.tsx'
import LoadingOverlay from '../../shared/LoadingOverlay.tsx'

import type { CanvasFeatureBackend } from './canvasFeatureBackendTypes.ts'
import type { FlatbushRegionCache, VisibleRegion } from './hitTesting.ts'
import type {
  FeatureDataResult,
  FlatbushItem,
  SubfeatureInfo,
} from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

interface LinearBasicDisplayModel {
  height: number
  laidOutDataMap: Map<number, FeatureDataResult>
  visibleRegions: VisibleRegion[]
  isLoading: boolean
  error: Error | null
  maxY: number
  hasOverflow: boolean
  heightBeforeExpand: number | undefined
  showLabels: boolean
  selectedFeatureId: string | undefined
  featureIdUnderMouse: string | null
  subfeatureIdUnderMouse: string | null
  hoveredFeature: FlatbushItem | null
  hoveredSubfeature: SubfeatureInfo | null
  scrollTop: number
  effectiveShowDescriptions: boolean
  regionTooLarge: boolean
  regionTooLargeReason: string
  regionCannotBeRendered: () => React.ReactNode
  featureDensityStats?: { bytes?: number }
  statusMessage: string | undefined
  setScrollTop: (n: number) => void
  setFeatureDensityStatsLimit: (s?: { bytes?: number }) => void
  reload: () => void
  expandToFit: () => void
  collapseFromExpand: () => void
  setFeatureIdUnderMouse: (featureId: string | null) => void
  setSubfeatureIdUnderMouse: (featureId: string | null) => void
  clearHover: () => void
  mouseoverExtraInformation: string | undefined
  setMouseoverExtraInformation: (info: string | undefined) => void
  selectFeatureById: (
    featureInfo: FlatbushItem,
    subfeatureInfo: SubfeatureInfo | undefined,
    displayedRegionIndex: number,
  ) => void
  showContextMenuForFeature: (
    featureInfo: FlatbushItem,
    displayedRegionIndex: number,
  ) => void
  setContextMenuInfo: (info?: unknown) => void
  contextMenuItems: () => { label: string; onClick: () => void }[]
  getFeatureById: (featureId: string) => FlatbushItem | undefined
  clearSelection: () => void
  startGpuBackendLifecycle: (backend: CanvasFeatureBackend) => void
  stopGpuBackendLifecycle: () => void
  renderNow: () => void
}

export interface Props {
  model: LinearBasicDisplayModel
}

type FeatureItemEntry =
  | { item: FlatbushItem; vr: VisibleRegion; data: FeatureDataResult }
  | { item: SubfeatureInfo; vr: VisibleRegion }

const OverlayLayer = ({ children }: { children: React.ReactNode }) =>
  children ? (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    >
      {children}
    </div>
  ) : null

const ContextMenu = observer(function ContextMenu({
  model,
  contextCoord,
  onClose,
}: {
  model: LinearBasicDisplayModel
  contextCoord: [number, number]
  onClose: () => void
}) {
  const items = model.contextMenuItems()
  return (
    <Menu
      open={items.length > 0}
      onMenuItemClick={(_, callback) => {
        callback()
        onClose()
      }}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={{
        top: contextCoord[1],
        left: contextCoord[0],
      }}
      menuItems={items}
    />
  )
})

const FeatureComponent = observer(function FeatureComponent({ model }: Props) {
  // false positive: omitting <[number,number]> widens to number[] — known tuple issue
  // https://github.com/typescript-eslint/typescript-eslint/issues/9529
  const [clientXY, setClientXY] = useState<[number, number]>([0, 0])
  const [contextMenuCoord, setContextMenuCoord] = useState<
    [number, number] | undefined
  >()
  const flatbushCacheMapRef = useRef(new Map<number, FlatbushRegionCache>())
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const view = getContainingView(model) as LGV

  const { laidOutDataMap, error: modelError } = model

  const width = view.initialized ? view.trackWidthPx : undefined
  const height = model.height

  const openContextMenu = useCallback(
    (
      feature: FlatbushItem,
      displayedRegionIndex: number,
      clientX: number,
      clientY: number,
    ) => {
      model.showContextMenuForFeature(feature, displayedRegionIndex)
      model.setMouseoverExtraInformation(undefined)
      setContextMenuCoord([clientX, clientY])
    },
    [model],
  )

  // The model owns the upload/render autorun and the GPU backend lifecycle —
  // see startGpuBackendLifecycle / stopGpuBackendLifecycle / renderNow on the
  // base canvas display model. scrollTop lives on the model (via
  // TrackHeightMixin); the scroll handler below writes DOM scrollTop into
  // the model so the autorun picks it up as part of `renderState`.
  const {
    canvasRef,
    error: gpuError,
    retry,
  } = useGpuModelLifecycle(CanvasFeatureRenderer, model)

  const error = gpuError || modelError

  // Sync model.scrollTop → DOM when it changes programmatically (e.g. on
  // dataset reset via clearDisplaySpecificData). DOM → model sync lives in
  // the scroll listener below.
  useEffect(
    () =>
      autorun(() => {
        const target = model.scrollTop
        const container = scrollContainerRef.current
        if (container && container.scrollTop !== target) {
          container.scrollTop = target
        }
      }),
    [model],
  )

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) {
      return
    }

    let rafId = 0
    const scheduleSync = () => {
      if (rafId === 0) {
        rafId = requestAnimationFrame(() => {
          rafId = 0
          // Write DOM scroll position into the model — the autorun watches
          // self.scrollTop via renderState and re-renders on change.
          model.setScrollTop(container.scrollTop)
        })
      }
    }

    const handleWheel = (e: WheelEvent) => {
      if (model.hasOverflow) {
        if (view.scrollZoom && !e.shiftKey) {
          e.preventDefault()
        } else {
          e.stopPropagation()
        }
      }
    }

    container.addEventListener('scroll', scheduleSync, { passive: true })
    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      container.removeEventListener('scroll', scheduleSync)
      container.removeEventListener('wheel', handleWheel)
      if (rafId !== 0) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [model, view])

  const hitTestAtEvent = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    const scrollTop = scrollContainerRef.current?.scrollTop ?? 0
    const yPos = mouseY + scrollTop
    const cache = flatbushCacheMapRef.current
    for (const key of cache.keys()) {
      if (!model.laidOutDataMap.has(key)) {
        cache.delete(key)
      }
    }
    return performMultiRegionHitDetection(
      cache,
      model.laidOutDataMap,
      view.visibleRegions,
      mouseX,
      yPos,
      model.effectiveShowDescriptions,
    )
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (contextMenuCoord) {
      return
    }
    setClientXY([e.clientX, e.clientY])
    if (model.laidOutDataMap.size === 0) {
      model.clearHover()
      return
    }

    const result = hitTestAtEvent(e)

    if (result.feature) {
      if (result.subfeature) {
        model.setMouseoverExtraInformation(
          result.subfeature.tooltip ?? result.subfeature.type,
        )
        model.setSubfeatureIdUnderMouse(result.subfeature.featureId)
      } else {
        model.setMouseoverExtraInformation(result.feature.tooltip)
        model.setSubfeatureIdUnderMouse(null)
      }
      model.setFeatureIdUnderMouse(result.feature.featureId)
    } else {
      model.clearHover()
    }
  }

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (model.laidOutDataMap.size === 0) {
      return
    }
    const result = hitTestAtEvent(e)
    if (result.feature) {
      model.selectFeatureById(
        result.feature,
        result.subfeature ?? undefined,
        result.displayedRegionIndex,
      )
    } else {
      model.clearSelection()
    }
  }

  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (model.laidOutDataMap.size === 0) {
      return
    }
    const result = hitTestAtEvent(e)
    if (result.feature) {
      e.preventDefault()
      openContextMenu(
        result.feature,
        result.displayedRegionIndex,
        e.clientX,
        e.clientY,
      )
    }
  }

  const handleMouseLeave = () => {
    if (!contextMenuCoord) {
      model.clearHover()
    }
  }

  const bpPerPx = view.bpPerPx
  const visibleRegions = view.visibleRegions

  const featureItemMap = useMemo(() => {
    const map = new Map<string, FeatureItemEntry>()
    for (const vr of visibleRegions) {
      const data = laidOutDataMap.get(vr.displayedRegionIndex)
      if (data) {
        for (const f of data.flatbushItems) {
          map.set(f.featureId, { item: f, vr, data })
        }
        for (const s of data.subfeatureInfos) {
          if (!map.has(s.featureId)) {
            map.set(s.featureId, { item: s, vr })
          }
        }
      }
    }
    return map
  }, [laidOutDataMap, visibleRegions])

  const onLabelMouseOver = useCallback(
    (item: FlatbushItem, e: React.MouseEvent) => {
      setClientXY([e.clientX, e.clientY])
      model.setFeatureIdUnderMouse(item.featureId)
      model.setSubfeatureIdUnderMouse(null)
      model.setMouseoverExtraInformation(item.tooltip)
    },
    [model],
  )

  const floatingLabelElements = useFloatingLabels(
    laidOutDataMap,
    visibleRegions,
    view.initialized,
    width,
    bpPerPx,
    model,
    openContextMenu,
    onLabelMouseOver,
  )

  const aminoAcidOverlayElements = useAminoAcidOverlay(
    laidOutDataMap,
    visibleRegions,
    view.initialized,
    width,
    bpPerPx,
  )

  const highlightOverlays = useHighlightOverlays(
    featureItemMap,
    visibleRegions,
    view.initialized,
    width,
    bpPerPx,
    model,
  )

  if (error) {
    return (
      <ErrorOverlay
        error={error}
        width={width ?? '100%'}
        height={height}
        onRetry={() => {
          retry()
          model.reload()
        }}
      />
    )
  }

  if (model.regionTooLarge) {
    return model.regionCannotBeRendered()
  }

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height,
      }}
    >
      <div
        ref={scrollContainerRef}
        style={{
          position: 'absolute',
          inset: 0,
          overflowY: model.hasOverflow ? 'auto' : 'hidden',
          overflowX: 'hidden',
        }}
      >
        <div
          style={{
            position: 'relative',
            height: model.hasOverflow ? model.maxY : '100%',
            minHeight: '100%',
          }}
        >
          <canvas
            ref={canvasRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
            onContextMenu={handleContextMenu}
            style={{
              display: 'block',
              width,
              height,
              position: 'sticky',
              top: 0,
              cursor: model.hoveredFeature ? 'pointer' : 'default',
            }}
          />

          <OverlayLayer>{highlightOverlays}</OverlayLayer>
          <OverlayLayer>{floatingLabelElements}</OverlayLayer>
          <OverlayLayer>{aminoAcidOverlayElements}</OverlayLayer>
        </div>
      </div>

      {model.hasOverflow || model.heightBeforeExpand !== undefined ? (
        <OverflowIndicator
          expanded={model.heightBeforeExpand !== undefined}
          showScrollHint={view.scrollZoom && model.hasOverflow}
          onExpand={model.expandToFit}
          onRestore={model.collapseFromExpand}
        />
      ) : null}

      <CanvasLoadingOverlay model={model} />
      <FeatureTooltip
        info={model.mouseoverExtraInformation}
        clientMouseCoord={clientXY}
      />
      {contextMenuCoord ? (
        <ContextMenu
          model={model}
          contextCoord={contextMenuCoord}
          onClose={() => {
            setContextMenuCoord(undefined)
            model.setContextMenuInfo(undefined)
            model.clearHover()
          }}
        />
      ) : null}
    </div>
  )
})

const CanvasLoadingOverlay = observer(function CanvasLoadingOverlay({
  model,
}: {
  model: Pick<LinearBasicDisplayModel, 'isLoading' | 'statusMessage'>
}) {
  const view = getContainingView(model) as LGV
  return (
    <LoadingOverlay
      statusMessage={model.statusMessage || 'Loading'}
      isVisible={model.isLoading || !view.initialized}
    />
  )
})

export default FeatureComponent
