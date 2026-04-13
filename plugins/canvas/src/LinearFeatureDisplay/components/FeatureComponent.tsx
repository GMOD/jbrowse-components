import React, {
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
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

import type { FeatureRenderBlock } from './canvasFeatureBackendTypes.ts'
import type { FlatbushRegionCache, VisibleRegion } from './hitTesting.ts'
import type {
  FeatureDataResult,
  FlatbushItem,
  SubfeatureInfo,
} from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

interface LinearFeatureDisplayModel {
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
}

export interface Props {
  model: LinearFeatureDisplayModel
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
  model: LinearFeatureDisplayModel
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

  const {
    error: gpuError,
    ready: rendererReady,
    rendererRef,
    retry,
  } = useGpuRenderer(canvasRef, CanvasFeatureRenderer)

  const renderWithBlocks = useEffectEvent(() => {
    const renderer = rendererRef.current
    if (!renderer || !view.initialized || width === undefined) {
      return
    }

    const visibleRegions = view.visibleRegions
    if (visibleRegions.length === 0) {
      return
    }

    const blocks: FeatureRenderBlock[] = []
    for (const vr of visibleRegions) {
      blocks.push({
        regionNumber: vr.regionNumber,
        bpRangeX: [vr.start, vr.end],
        screenStartPx: vr.screenStartPx,
        screenEndPx: vr.screenEndPx,
        reversed: vr.reversed ?? false,
      })
    }

    renderer.renderBlocks(blocks, {
      scrollY: scrollContainerRef.current?.scrollTop ?? 0,
      canvasWidth: view.trackWidthPx,
      canvasHeight: model.height,
    })
  })

  const error = gpuError || modelError

  useEffect(() => {
    const dispose = autorun(() => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { offsetPx: _op, bpPerPx: _bpp, initialized, width: _w } = view
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _h = model.height

        if (!initialized) {
          return
        }

        renderWithBlocks()
      } catch {
        // Model may have been detached from state tree
      }
    })

    return () => {
      dispose()
    }
  }, [view, model])

  // useLayoutEffect ensures GPU data is uploaded before paint, keeping
  // WebGL features in sync with the DOM label overlay (which is computed
  // during the same render via useMemo). useEffect would run after paint,
  // causing a frame where labels show new data but WebGL shows old data.
  //
  // SYNC: unlike the other GPU displays (which use an autorun and read
  // dataVersion explicitly), this component uses observer() +
  // useLayoutEffect([..., rpcDataMap]). The observer re-renders when
  // rpcDataMap changes reference, which fires this effect and uploads
  // data. dataVersion is not needed here because rpcDataMap always gets
  // a new Map reference when work() completes — the reference change is
  // the sole trigger. See MultiRegionDisplayMixin.withFetchLifecycle.

  useLayoutEffect(() => {
    const renderer = rendererRef.current
    if (!renderer || !rendererReady) {
      return
    }

    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0
    }

    if (rpcDataMap.size === 0) {
      renderer.pruneRegions([])
      flatbushCacheMapRef.current.clear()
      return
    }

    // DO NOT use an identity check (prevData === data) to skip uploads.
    //
    // relayoutForCurrentZoom() mutates data.rectYs and
    // data.floatingLabelsData[].topY IN PLACE when the user zooms,
    // then calls setRpcDataMap(new Map(...)) which changes the Map
    // reference but keeps the same data object references. An identity
    // check would see the same object and skip the upload, leaving the
    // GPU with stale Y positions while labels show the updated ones —
    // causing features and labels to become permanently misaligned.
    //
    // This effect only fires when rpcDataMap changes reference (on
    // fetch completion or relayout), not on every scroll tick, so
    // always re-uploading is safe and correct.
    for (const [regionNumber, data] of rpcDataMap) {
      renderer.uploadRegion(regionNumber, data)
    }
    renderer.pruneRegions([...rpcDataMap.keys()])

    clearHoverState()

    renderWithBlocks()
    if (rpcDataMap.size > 0) {
      model.setCanvasDrawn(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, rpcDataMap, rendererReady])

  useTabVisibilityRerender(renderWithBlocks)

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) {
      return
    }

    let rafId = 0
    const scheduleRender = () => {
      if (rafId === 0) {
        rafId = requestAnimationFrame(() => {
          rafId = 0
          renderWithBlocks()
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

    container.addEventListener('scroll', scheduleRender, { passive: true })
    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      container.removeEventListener('scroll', scheduleRender)
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
