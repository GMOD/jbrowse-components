import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { ErrorOverlay, Menu } from '@jbrowse/core/ui'
import {
  getContainingView,
  useDebounce,
  useGpuRenderer,
  useTabVisibilityRerender,
} from '@jbrowse/core/util'
import { TooLargeMessage } from '@jbrowse/plugin-linear-genome-view'
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
  rpcDataMap: Map<number, FeatureDataResult>
  visibleRegions: VisibleRegion[]
  isLoading: boolean
  error: Error | null
  maxY: number
  hasOverflow: boolean
  heightBeforeExpand: number | undefined
  showLabels: boolean
  selectedFeatureId: string | undefined
  featureIdUnderMouse: string | null
  effectiveShowDescriptions: boolean
  regionTooLarge: boolean
  regionTooLargeReason: string
  featureDensityStats?: { bytes?: number }
  statusMessage: string | undefined
  scrollTop: number
  setScrollTop: (n: number) => void
  setFeatureDensityStatsLimit: (s?: { bytes?: number }) => void
  reload: () => void
  expandToFit: () => void
  collapseFromExpand: () => void
  setFeatureIdUnderMouse: (featureId: string | null) => void
  mouseoverExtraInformation: string | undefined
  setMouseoverExtraInformation: (info: string | undefined) => void
  selectFeatureById: (
    featureInfo: FlatbushItem,
    subfeatureInfo: SubfeatureInfo | undefined,
    regionNumber: number,
  ) => void
  showContextMenuForFeature: (
    featureInfo: FlatbushItem,
    regionNumber: number,
  ) => void
  setContextMenuInfo: (info?: unknown) => void
  contextMenuItems: () => { label: string; onClick: () => void }[]
  getFeatureById: (featureId: string) => FlatbushItem | undefined
  setCanvasDrawn: (val: boolean) => void
  clearSelection: () => void
  startGpuBackendLifecycle: (
    backend: import('./canvasFeatureBackendTypes.ts').CanvasFeatureBackend,
  ) => void
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
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hoveredFeature, setHoveredFeature] = useState<FlatbushItem | null>(
    null,
  )
  const [hoveredSubfeature, setHoveredSubfeature] =
    useState<SubfeatureInfo | null>(null)
  // false positive: omitting <[number,number]> widens to number[] — known tuple issue
  // https://github.com/typescript-eslint/typescript-eslint/issues/9529

  const [clientXY, setClientXY] = useState<[number, number]>([0, 0])
  const [contextMenuCoord, setContextMenuCoord] = useState<
    [number, number] | undefined
  >()
  const flatbushCacheMapRef = useRef(new Map<number, FlatbushRegionCache>())
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const view = getContainingView(model) as LGV

  const { rpcDataMap, isLoading, error: modelError } = model
  const debouncedLoading = useDebounce(isLoading, 500)

  const width = view.initialized ? view.trackWidthPx : undefined
  const height = model.height

  const clearHoverState = useCallback(() => {
    model.setMouseoverExtraInformation(undefined)
    setHoveredFeature(null)
    setHoveredSubfeature(null)
    model.setFeatureIdUnderMouse(null)
  }, [model])

  const openContextMenu = useCallback(
    (
      feature: FlatbushItem,
      regionNumber: number,
      clientX: number,
      clientY: number,
    ) => {
      model.showContextMenuForFeature(feature, regionNumber)
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
  const { error: gpuError, retry } = useGpuRenderer(
    canvasRef,
    CanvasFeatureRenderer,
    {
      onReady: backend => {
        model.startGpuBackendLifecycle(backend)
      },
      onDispose: () => {
        model.stopGpuBackendLifecycle()
      },
    },
  )

  const error = gpuError || modelError

  // Keep the flatbush hit-testing cache in sync with rpcDataMap, and reset
  // hover + DOM scroll when data arrives. These are DOM/React-side concerns
  // independent of the GPU upload pipeline.
  useEffect(() => {
    for (const key of flatbushCacheMapRef.current.keys()) {
      if (!rpcDataMap.has(key)) {
        flatbushCacheMapRef.current.delete(key)
      }
    }
    if (rpcDataMap.size === 0) {
      flatbushCacheMapRef.current.clear()
    }
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0
    }
    clearHoverState()
  }, [rpcDataMap, clearHoverState])

  useTabVisibilityRerender(() => {
    model.renderNow()
  })

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
    return performMultiRegionHitDetection(
      flatbushCacheMapRef.current,
      model.rpcDataMap,
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
    if (model.rpcDataMap.size === 0) {
      clearHoverState()
      return
    }

    const result = hitTestAtEvent(e)

    if (result.feature) {
      if (result.subfeature) {
        model.setMouseoverExtraInformation(
          result.subfeature.tooltip ?? result.subfeature.type,
        )
        setHoveredSubfeature(result.subfeature)
      } else {
        model.setMouseoverExtraInformation(result.feature.tooltip)
        setHoveredSubfeature(null)
      }
      setHoveredFeature(result.feature)
      model.setFeatureIdUnderMouse(result.feature.featureId)
    } else {
      clearHoverState()
    }
  }

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (model.rpcDataMap.size === 0) {
      return
    }
    const result = hitTestAtEvent(e)
    if (result.feature) {
      model.selectFeatureById(
        result.feature,
        result.subfeature ?? undefined,
        result.regionNumber,
      )
    } else {
      model.clearSelection()
    }
  }

  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (model.rpcDataMap.size === 0) {
      return
    }
    const result = hitTestAtEvent(e)
    if (result.feature) {
      e.preventDefault()
      openContextMenu(result.feature, result.regionNumber, e.clientX, e.clientY)
    }
  }

  const handleMouseLeave = () => {
    if (!contextMenuCoord) {
      clearHoverState()
    }
  }

  const bpPerPx = view.bpPerPx
  const visibleRegions = view.visibleRegions

  const featureItemMap = useMemo(() => {
    const map = new Map<string, FeatureItemEntry>()
    for (const vr of visibleRegions) {
      const data = rpcDataMap.get(vr.regionNumber)
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
  }, [rpcDataMap, visibleRegions])

  const onLabelMouseOver = useCallback(
    (item: FlatbushItem, e: React.MouseEvent) => {
      setClientXY([e.clientX, e.clientY])
      setHoveredFeature(item)
      setHoveredSubfeature(null)
      model.setFeatureIdUnderMouse(item.featureId)
      model.setMouseoverExtraInformation(item.tooltip)
    },
    [model],
  )

  const floatingLabelElements = useFloatingLabels(
    rpcDataMap,
    visibleRegions,
    view.initialized,
    width,
    bpPerPx,
    model,
    openContextMenu,
    onLabelMouseOver,
  )

  const aminoAcidOverlayElements = useAminoAcidOverlay(
    rpcDataMap,
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
    hoveredFeature,
    hoveredSubfeature,
    model.selectedFeatureId,
    model.effectiveShowDescriptions,
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

  const isReady = view.initialized

  if (model.regionTooLarge) {
    return <TooLargeMessage model={model} />
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
              cursor: hoveredFeature ? 'pointer' : 'default',
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

      <LoadingOverlay
        statusMessage={
          debouncedLoading
            ? model.statusMessage || 'Loading features'
            : 'Initializing'
        }
        isVisible={debouncedLoading || !isReady}
      />
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
            clearHoverState()
          }}
        />
      ) : null}
    </div>
  )
})

export default FeatureComponent
