import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

import {
  getContainingTrack,
  getContainingView,
  getSession,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import useMeasure from '@jbrowse/core/util/useMeasure'
import { TooLargeMessage } from '@jbrowse/plugin-linear-genome-view'
import { useTheme } from '@mui/material'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import { getContrastBaseMap } from '../../shared/util.ts'
import { YSCALEBAR_LABEL_OFFSET, getInsertionType } from '../model.ts'
import BlockMsg from './BlockMsg.tsx'
import CoverageYScaleBar from './CoverageYScaleBar.tsx'
import LoadingOverlay from './LoadingOverlay.tsx'
import { getCoordinator, removeCoordinator } from './ViewCoordinator.ts'
import { WebGLRenderer } from './WebGLRenderer.ts'
import {
  CIGAR_TYPE_LABELS,
  buildColorPaletteFromTheme,
  canvasToGenomicCoords,
  formatCigarTooltip,
  getCanvasCoords,
  uploadRegionDataToGPU,
} from './alignmentComponentUtils.ts'
import {
  INTERBASE_TYPES,
  hitTestCigarItem as hitTestCigarItemFn,
  hitTestCoverage as hitTestCoverageFn,
  hitTestFeature as hitTestFeatureFn,
  hitTestIndicator as hitTestIndicatorFn,
  hitTestSashimiArc as hitTestSashimiArcFn,
} from './hitTesting.ts'

import type { CoverageTicks } from './CoverageYScaleBar.tsx'
import type { ResolvedBlock } from './hitTesting.ts'
import type { WebGLArcsDataResult } from '../../RenderWebGLArcsDataRPC/types.ts'
import type { WebGLCloudDataResult } from '../../RenderWebGLCloudDataRPC/types.ts'
import type { WebGLPileupDataResult } from '../../RenderWebGLPileupDataRPC/types.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

interface FeatureInfo {
  id: string
  name: string
  start: number
  end: number
  flags: number | undefined
  mapq: number | undefined
  strand: string
  refName: string
}

interface VisibleRegionBlock {
  refName: string
  regionNumber: number
  start: number
  end: number
  assemblyName: string
  screenStartPx: number
  screenEndPx: number
}

interface LinearAlignmentsDisplayModel {
  height: number
  rpcData: WebGLPileupDataResult | null
  rpcDataMap: Map<number, WebGLPileupDataResult>
  loadedRegion: { refName: string; start: number; end: number } | null
  loadedRegions: Map<number, { refName: string; start: number; end: number }>
  visibleRegions: VisibleRegionBlock[]
  showLoading: boolean
  statusMessage?: string
  error: Error | null
  featureHeightSetting: number
  featureSpacing: number
  colorSchemeIndex: number
  showCoverage: boolean
  coverageHeight: number
  showMismatches: boolean
  showInterbaseCounts: boolean
  showInterbaseIndicators: boolean
  showModifications: boolean
  showSashimiArcs: boolean
  maxY: number
  regionTooLarge: boolean
  regionTooLargeReason: string
  featureDensityStats?: { bytes?: number; featureDensity?: number }
  setFeatureDensityStatsLimit: (s?: unknown) => void
  reload: () => void
  featureIdUnderMouse: string | undefined
  coverageTicks?: CoverageTicks
  currentRangeY: [number, number]
  highlightedFeatureIndex: number
  selectedFeatureIndex: number
  setMaxY: (y: number) => void
  setCurrentBpRange: (domain: [number, number]) => void
  setCurrentRangeY: (rangeY: [number, number]) => void
  setCoverageHeight: (height: number) => void
  setHighlightedFeatureIndex: (index: number) => void
  setSelectedFeatureIndex: (index: number) => void
  setFeatureIdUnderMouse: (id: string | undefined) => void
  setMouseoverExtraInformation: (info: string | undefined) => void
  selectFeatureById: (featureId: string) => void
  getFeatureInfoById: (featureId: string) => FeatureInfo | undefined
  renderingMode: 'pileup' | 'arcs' | 'cloud'
  arcsState: {
    rpcData: WebGLArcsDataResult | null
    rpcDataMap: Map<number, WebGLArcsDataResult>
    lineWidth: number
  }
  cloudState: {
    rpcData: WebGLCloudDataResult | null
    rpcDataMap: Map<number, WebGLCloudDataResult>
  }
}

export interface Props {
  model: LinearAlignmentsDisplayModel
}

/**
 * WebGL Alignments Component
 *
 * Renders pileup, arcs, and cloud modes in a single WebGL canvas with shared coverage.
 *
 * Architecture: Hybrid approach - MobX is source of truth, but render immediately.
 *
 * The view's offsetPx and bpPerPx are the source of truth for coordinates.
 * This ensures perfect alignment with gridlines and other components.
 *
 * During interaction:
 * 1. We update MobX immediately via view.setNewView() (for gridlines, other components)
 * 2. We render WebGL immediately with computed values (don't wait for MobX reaction)
 *
 * The useEffect watching MobX state handles external navigation (keyboard, clicks).
 */

const WebGLAlignmentsComponent = observer(function WebGLAlignmentsComponent({
  model,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<WebGLRenderer | null>(null)
  const canvasId = useId()

  // Use ResizeObserver via useMeasure for passive dimension tracking
  // This avoids forced layout from reading clientWidth/clientHeight
  const [measureRef, measuredDims] = useMeasure()

  // Track if over a CIGAR item for cursor
  const [overCigarItem, setOverCigarItem] = useState(false)
  // Track hover state for resize handle
  const [resizeHandleHovered, setResizeHandleHovered] = useState(false)

  const [maxY, setMaxY] = useState(0)
  const [rendererReady, setRendererReady] = useState(false)

  // Cache canvas bounding rect with timestamp for smart invalidation
  // 100ms threshold catches scroll and repositioning events
  const canvasRectRef = useRef<{ rect: DOMRect; timestamp: number } | null>(
    null,
  )

  // Rendering and data loading
  const renderRAFRef = useRef<number | null>(null)
  const scheduleRenderRef = useRef<() => void>(() => {})

  // Drag state for panning
  const dragRef = useRef({
    isDragging: false,
    lastX: 0,
  })

  // Drag state for coverage height resize
  const resizeDragRef = useRef({
    isDragging: false,
    startY: 0,
    startHeight: 0,
  })

  const view = getContainingView(model) as LinearGenomeViewModel | undefined
  const viewId = view?.id

  // Get theme for dynamic colors
  const theme = useTheme()

  // Build color palette from theme (memoized to avoid unnecessary recalculations)
  const colorPalette = useMemo(() => buildColorPaletteFromTheme(theme), [theme])

  const contrastMap = useMemo(() => getContrastBaseMap(theme), [theme])

  const {
    rpcData,
    rpcDataMap,
    statusMessage,
    error,
    featureHeightSetting,
    featureSpacing,
    colorSchemeIndex,
    showCoverage,
    coverageHeight,
    showMismatches,
    showInterbaseCounts,
    showInterbaseIndicators,
    showModifications,
    showSashimiArcs,
    renderingMode,
  } = model

  // Use measured dimensions from ResizeObserver (preferred, passive)
  // Fall back to view.width if not yet measured
  const width =
    measuredDims.width ?? (view?.initialized ? view.width : undefined)
  const height = model.height
  const minOffset = view?.minOffset ?? 0
  const maxOffset = view?.maxOffset ?? Infinity

  const clampOffset = useCallback(
    (offset: number): number =>
      Math.max(minOffset, Math.min(maxOffset, offset)),
    [minOffset, maxOffset],
  )

  // Compute visible range for the primary (first) refName from view state.
  // Returns null if view is not ready. For multi-ref views, returns the range
  // for only the first refName's blocks.
  const getVisibleBpRange = useCallback((): [number, number] | null => {
    if (!view?.initialized || width === undefined) {
      return null
    }

    const dynamicBlocks = (
      view as unknown as {
        dynamicBlocks?: {
          contentBlocks?: {
            refName: string
            start: number
            end: number
            offsetPx?: number
            widthPx?: number
          }[]
        }
      }
    ).dynamicBlocks
    const contentBlocks = dynamicBlocks?.contentBlocks as
      | {
          refName: string
          start: number
          end: number
          offsetPx?: number
          widthPx?: number
        }[]
      | undefined
    if (!contentBlocks || contentBlocks.length === 0) {
      return null
    }
    const first = contentBlocks[0]
    if (!first) {
      return null
    }

    const last = contentBlocks[contentBlocks.length - 1]
    if (first.refName === last?.refName) {
      // Single-ref: compute visible range from view's coordinate system
      const bpPerPx = view.bpPerPx
      const blockOffsetPx = first.offsetPx ?? 0
      const deltaPx = view.offsetPx - blockOffsetPx
      const deltaBp = deltaPx * bpPerPx

      const rangeStart = first.start + deltaBp
      const rangeEnd = rangeStart + width * bpPerPx
      return [rangeStart, rangeEnd]
    }

    // Multi-ref view: return the range for the first refName only
    // (used for domain sync and backward-compat)
    const bpPerPx = view.bpPerPx
    const blockOffsetPx = first.offsetPx ?? 0
    const deltaPx = view.offsetPx - blockOffsetPx
    const deltaBp = deltaPx * bpPerPx

    const rangeStart = first.start + deltaBp
    const blockEndPx = blockOffsetPx + (first.widthPx ?? 0)
    const clippedEndPx = Math.min(view.offsetPx + width, blockEndPx)
    const rangeEnd = first.start + (clippedEndPx - blockOffsetPx) * bpPerPx
    return [rangeStart, rangeEnd]
  }, [view, width])

  // Render to WebGL canvas - reads domain from MobX view state (used by scheduled renders)
  const renderNow = useCallback(() => {
    const renderer = rendererRef.current
    if (!renderer || width === undefined) {
      return
    }

    const commonState = {
      rangeY: model.currentRangeY,
      colorScheme: colorSchemeIndex,
      featureHeight: featureHeightSetting,
      featureSpacing,
      showCoverage,
      coverageHeight,
      coverageYOffset: YSCALEBAR_LABEL_OFFSET,
      showMismatches,
      showInterbaseCounts,
      showInterbaseIndicators,
      showModifications,
      showSashimiArcs,
      canvasWidth: width,
      canvasHeight: height,
      highlightedFeatureIndex: model.highlightedFeatureIndex,
      selectedFeatureIndex: model.selectedFeatureIndex,
      colors: colorPalette,
      renderingMode,
      arcLineWidth: model.arcsState.lineWidth,
      cloudColorScheme: colorSchemeIndex,
    }

    // All modes use renderBlocks for multi-region support
    const regions = model.visibleRegions
    const blocks = regions.map(r => ({
      regionNumber: r.regionNumber,
      bpRangeX: [r.start, r.end] as [number, number],
      screenStartPx: r.screenStartPx,
      screenEndPx: r.screenEndPx,
    }))

    renderer.renderBlocks(blocks, { ...commonState, bpRangeX: [0, 0] })
  }, [
    model,
    colorSchemeIndex,
    colorPalette,
    featureHeightSetting,
    featureSpacing,
    showCoverage,
    coverageHeight,
    showMismatches,
    showInterbaseCounts,
    showInterbaseIndicators,
    showModifications,
    showSashimiArcs,
    renderingMode,
    width,
    height,
  ])

  const scheduleRender = useCallback(() => {
    if (renderRAFRef.current !== null) {
      cancelAnimationFrame(renderRAFRef.current)
    }
    renderRAFRef.current = requestAnimationFrame(() => {
      renderRAFRef.current = null
      renderNow()
    })
  }, [renderNow])

  // Keep refs updated for use in event handlers without causing effect re-runs
  scheduleRenderRef.current = scheduleRender

  // Refs for callbacks and values used in wheel/mouse handlers - prevents effect churn
  // Must be defined after the callbacks they reference
  const renderNowRef = useRef(renderNow)
  renderNowRef.current = renderNow
  const clampOffsetRef = useRef(clampOffset)
  clampOffsetRef.current = clampOffset
  const getVisibleBpRangeRef = useRef(getVisibleBpRange)
  getVisibleBpRangeRef.current = getVisibleBpRange
  const viewRef = useRef(view)
  viewRef.current = view
  const widthRef = useRef(width)
  widthRef.current = width

  // Initialize WebGL
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    try {
      rendererRef.current = new WebGLRenderer(canvas)
      setRendererReady(true)
    } catch (e) {
      console.error('Failed to initialize WebGL:', e)
    }
    return () => {
      rendererRef.current?.destroy()
      rendererRef.current = null
      setRendererReady(false)
    }
  }, [])

  // Subscribe to coordinator for cross-canvas sync
  // When another canvas in the same view updates, re-render
  useEffect(() => {
    if (!viewId) {
      return
    }
    const coordinator = getCoordinator(viewId)
    const unsubscribe = coordinator.subscribe(canvasId, () => {
      // Just trigger a re-render - we always read from view state
      renderNow()
    })
    return () => {
      unsubscribe()
      if (coordinator.listenerCount === 0) {
        removeCoordinator(viewId)
      }
    }
  }, [viewId, canvasId, renderNow])

  // Re-render when view state changes (pan/zoom from any source)
  // Like LinearSyntenyView, the autorun fires whenever view observables
  // change and renders directly. Event handlers just call view.setNewView()
  // and the autorun handles both domain sync and rendering.
  useEffect(() => {
    if (!view) {
      return
    }

    // Sync domain to model only when view pan/zoom changes
    const disposeDomainSync = autorun(
      () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { offsetPx: _op, bpPerPx: _bpp, initialized } = view
        if (!initialized) {
          return
        }

        const visibleBpRange = getVisibleBpRangeRef.current()
        if (visibleBpRange) {
          model.setCurrentBpRange(visibleBpRange)
        }
      },
      { name: 'WebGLAlignmentsComponent:domainSync' },
    )

    // Re-render when view or model visual state changes
    const disposeRender = autorun(
      () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { offsetPx: _op, bpPerPx: _bpp, initialized } = view
        if (!initialized) {
          return
        }

        const {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          currentRangeY: _ry,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          highlightedFeatureIndex: _hi,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          selectedFeatureIndex: _si,
        } = model

        renderNowRef.current()
      },
      { name: 'WebGLAlignmentsComponent:render' },
    )

    return () => {
      disposeDomainSync()
      disposeRender()
    }
  }, [view, model])

  // Upload all data to GPU from RPC typed arrays atomically
  // Read data, CIGAR data, and coverage/SNP data must be uploaded together
  // to prevent race conditions during rapid scrolling where coverage
  // rectangles could be rendered with stale SNP data (or vice versa)
  useEffect(() => {
    if (!rendererRef.current) {
      return
    }
    const maxYVal = uploadRegionDataToGPU(
      rendererRef.current,
      rpcDataMap,
      showCoverage,
    )
    if (maxYVal > 0) {
      setMaxY(maxYVal)
      model.setMaxY(maxYVal)
    }
    scheduleRenderRef.current()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rpcDataMap, showCoverage])

  // Upload arcs data to GPU per-region when arcsState.rpcDataMap changes
  const arcsRpcDataMap = model.arcsState.rpcDataMap
  useEffect(() => {
    if (!rendererRef.current || renderingMode !== 'arcs') {
      return
    }
    const renderer = rendererRef.current
    for (const [regionNumber, data] of arcsRpcDataMap) {
      renderer.uploadArcsFromTypedArraysForRegion(regionNumber, {
        regionStart: data.regionStart,
        arcX1: data.arcX1,
        arcX2: data.arcX2,
        arcColorTypes: data.arcColorTypes,
        arcIsArc: data.arcIsArc,
        numArcs: data.numArcs,
        linePositions: data.linePositions,
        lineYs: data.lineYs,
        lineColorTypes: data.lineColorTypes,
        numLines: data.numLines,
      })
    }
    scheduleRenderRef.current()
  }, [arcsRpcDataMap, renderingMode])

  // Upload cloud data to GPU per-region when cloudState.rpcDataMap changes
  const cloudRpcDataMap = model.cloudState.rpcDataMap
  useEffect(() => {
    if (!rendererRef.current || renderingMode !== 'cloud') {
      return
    }
    const renderer = rendererRef.current
    for (const [regionNumber, data] of cloudRpcDataMap) {
      renderer.uploadCloudFromTypedArraysForRegion(regionNumber, {
        regionStart: data.regionStart,
        chainPositions: data.chainPositions,
        chainYs: data.chainYs,
        chainFlags: data.chainFlags,
        chainColorTypes: data.chainColorTypes,
        numChains: data.numChains,
      })
    }
    scheduleRenderRef.current()
  }, [cloudRpcDataMap, renderingMode])

  // Re-render on settings change
  useEffect(() => {
    if (rendererReady) {
      scheduleRenderRef.current()
    }
  }, [
    rendererReady,
    colorSchemeIndex,
    colorPalette,
    featureHeightSetting,
    featureSpacing,
    showCoverage,
    coverageHeight,
    showMismatches,
    showInterbaseCounts,
    showInterbaseIndicators,
    showModifications,
    renderingMode,
    rpcDataMap,
  ])

  // Re-render when container dimensions change (from ResizeObserver)
  useEffect(() => {
    if (rendererReady && measuredDims.width !== undefined) {
      scheduleRenderRef.current()
    }
  }, [rendererReady, measuredDims.width, measuredDims.height])

  // Cleanup
  useEffect(() => {
    return () => {
      if (renderRAFRef.current) {
        cancelAnimationFrame(renderRAFRef.current)
      }
    }
  }, [])

  // Refs for values used in wheel handler that we don't want as dependencies
  const maxYRef = useRef(maxY)
  maxYRef.current = maxY
  const featureHeightRef = useRef(featureHeightSetting)
  featureHeightRef.current = featureHeightSetting
  const featureSpacingRef = useRef(featureSpacing)
  featureSpacingRef.current = featureSpacing

  // Wheel handler for zoom and pan
  // Updates view state directly - this is the single source of truth
  // Effect runs once on mount - all values accessed via refs
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const handleWheel = (e: WheelEvent) => {
      const view = viewRef.current
      const width = widthRef.current

      if (!view?.initialized || width === undefined) {
        return
      }

      const absX = Math.abs(e.deltaX)
      const absY = Math.abs(e.deltaY)

      // Horizontal scroll - pan
      if (absX > 5 && absX > absY * 2) {
        e.preventDefault()
        e.stopPropagation()
        const newOffsetPx = clampOffsetRef.current(view.offsetPx + e.deltaX)
        view.setNewView(view.bpPerPx, newOffsetPx)

        return
      }

      if (absY < 1) {
        return
      }

      if (e.shiftKey) {
        e.preventDefault()
        e.stopPropagation()
        // Vertical scroll within pileup (Y-axis panning, not part of view state)
        const rowHeight = featureHeightRef.current + featureSpacingRef.current
        const totalHeight = maxYRef.current * rowHeight
        const panAmount = e.deltaY * 0.5

        const prev = model.currentRangeY
        let newY: [number, number] = [prev[0] + panAmount, prev[1] + panAmount]
        if (newY[0] < 0) {
          newY = [0, newY[1] - newY[0]]
        }
        if (newY[1] > totalHeight + 50) {
          const overflow = newY[1] - totalHeight - 50
          newY = [newY[0] - overflow, newY[1] - overflow]
        }
        model.setCurrentRangeY(newY)
      }
    }

    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      canvas.removeEventListener('wheel', handleWheel)
    }
  }, [model])

  // Pan handlers - update view state directly
  // Use refs to avoid recreating callbacks on each render
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    dragRef.current = {
      isDragging: true,
      lastX: e.clientX,
    }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current.isDragging) {
      return
    }
    e.stopPropagation()

    const view = viewRef.current
    const width = widthRef.current
    if (!view || width === undefined) {
      return
    }

    const dx = e.clientX - dragRef.current.lastX
    dragRef.current.lastX = e.clientX

    // Horizontal pan - update view state, autorun handles rendering
    if (dx !== 0) {
      const newOffsetPx = clampOffsetRef.current(view.offsetPx - dx)
      view.setNewView(view.bpPerPx, newOffsetPx)
    }
  }, [])

  const handleMouseUp = useCallback(() => {
    dragRef.current.isDragging = false
  }, [])

  const handleMouseLeave = useCallback(() => {
    dragRef.current.isDragging = false
    model.setFeatureIdUnderMouse(undefined)
    model.setMouseoverExtraInformation(undefined)
    setOverCigarItem(false)
    if (model.highlightedFeatureIndex !== -1) {
      model.setHighlightedFeatureIndex(-1)
    }
  }, [model])

  // Resolve which rpcData + visible bp range to use for a given canvasX.
  // For multi-ref views, finds the block the click falls in.
  const resolveBlockForCanvasX = useCallback(
    (canvasX: number): ResolvedBlock | undefined => {
      const view = viewRef.current
      if (!view?.initialized) {
        return undefined
      }

      const regions = model.visibleRegions
      const dataMap = model.rpcDataMap

      for (const r of regions) {
        if (canvasX >= r.screenStartPx && canvasX < r.screenEndPx) {
          const data = dataMap.get(r.regionNumber)
          if (data) {
            return {
              rpcData: data,
              bpRange: [r.start, r.end],
              blockStartPx: r.screenStartPx,
              blockWidth: r.screenEndPx - r.screenStartPx,
              refName: r.refName,
            }
          }
        }
      }
      return undefined
    },
    [model],
  )

  // Hit test to find feature at given canvas coordinates
  // Returns { id, index } or undefined

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (dragRef.current.isDragging) {
        handleMouseMove(e)
        return
      }

      const coords = getCanvasCoords(e, canvasRef, canvasRectRef)
      if (!coords) {
        return
      }
      const { canvasX, canvasY } = coords

      // Resolve which block this canvasX belongs to (for tooltip data lookup)
      const blockInfo = resolveBlockForCanvasX(canvasX)
      const blockRpcData = blockInfo?.rpcData

      // Check for indicator hits first (triangles at top of coverage)
      const indicatorResolved = resolveBlockForCanvasX(canvasX)
      const indicatorHit = hitTestIndicatorFn(
        canvasX,
        canvasY,
        indicatorResolved,
        showCoverage,
        showInterbaseIndicators,
      )
      if (indicatorHit) {
        setOverCigarItem(true)
        model.setFeatureIdUnderMouse(undefined)

        // Look up detailed tooltip data from rpcData
        const posOffset =
          indicatorHit.position - (blockRpcData?.regionStart ?? 0)
        const tooltipBin = blockRpcData?.tooltipData[posOffset]
        const refName = blockInfo?.refName

        if (tooltipBin) {
          const tooltipData = JSON.stringify({
            type: 'indicator',
            bin: tooltipBin,
            refName,
          })
          model.setMouseoverExtraInformation(tooltipData)
        } else {
          // Fallback: show basic counts when detailed bin data unavailable
          const { counts } = indicatorHit
          const total = counts.insertion + counts.softclip + counts.hardclip
          const interbaseData: Record<
            string,
            { count: number; minLen: number; maxLen: number; avgLen: number }
          > = {}
          for (const type of INTERBASE_TYPES) {
            if (counts[type] > 0) {
              interbaseData[type] = {
                count: counts[type],
                minLen: 0,
                maxLen: 0,
                avgLen: 0,
              }
            }
          }
          const tooltipData = JSON.stringify({
            type: 'indicator',
            bin: {
              position: indicatorHit.position,
              depth: total,
              interbase: interbaseData,
            },
            refName,
          })
          model.setMouseoverExtraInformation(tooltipData)
        }

        if (model.highlightedFeatureIndex !== -1) {
          model.setHighlightedFeatureIndex(-1)
        }
        return
      }

      // Check for sashimi arc hits (splice junction arcs overlaid on coverage)
      const sashimiResolved = resolveBlockForCanvasX(canvasX)
      const sashimiHit = hitTestSashimiArcFn(
        canvasX,
        canvasY,
        sashimiResolved,
        showCoverage,
        showSashimiArcs,
        coverageHeight,
      )
      if (sashimiHit) {
        setOverCigarItem(true)
        model.setFeatureIdUnderMouse(undefined)
        const strandLabel =
          sashimiHit.strand === 1
            ? '+'
            : sashimiHit.strand === -1
              ? '-'
              : 'unknown'
        const tooltipData = JSON.stringify({
          type: 'sashimi',
          start: sashimiHit.start,
          end: sashimiHit.end,
          score: sashimiHit.score,
          strand: strandLabel,
          refName: sashimiHit.refName,
        })
        model.setMouseoverExtraInformation(tooltipData)
        if (model.highlightedFeatureIndex !== -1) {
          model.setHighlightedFeatureIndex(-1)
        }
        return
      }

      // Check for coverage area hits (grey bars + SNP segments)
      const coverageHit = hitTestCoverageFn(
        canvasX,
        canvasY,
        resolveBlockForCanvasX(canvasX),
        showCoverage,
        coverageHeight,
      )
      if (coverageHit) {
        setOverCigarItem(true)
        model.setFeatureIdUnderMouse(undefined)

        // Look up detailed tooltip data from rpcData
        const posOffset =
          coverageHit.position - (blockRpcData?.regionStart ?? 0)
        // Use exact position's data only - don't check adjacent positions
        // This prevents tooltip from showing stale data from neighboring positions
        const tooltipBin = blockRpcData?.tooltipData[posOffset]
        const refName = blockInfo?.refName

        if (tooltipBin || coverageHit.depth > 0) {
          const bin = tooltipBin ?? {
            position: coverageHit.position,
            depth: coverageHit.depth,
            snps: {},
            interbase: {},
          }
          // Add basic SNP data from hit test if no detailed tooltip bin exists
          if (!tooltipBin && coverageHit.snps.length > 0) {
            for (const snp of coverageHit.snps) {
              if (
                snp.base === 'A' ||
                snp.base === 'C' ||
                snp.base === 'G' ||
                snp.base === 'T'
              ) {
                bin.snps[snp.base] = { count: snp.count, fwd: 0, rev: 0 }
              } else if (
                snp.base === 'insertion' ||
                snp.base === 'softclip' ||
                snp.base === 'hardclip'
              ) {
                bin.interbase[snp.base] = {
                  count: snp.count,
                  minLen: 0,
                  maxLen: 0,
                  avgLen: 0,
                }
              }
            }
          }

          const tooltipData = JSON.stringify({
            type: 'coverage',
            bin,
            refName,
          })
          model.setMouseoverExtraInformation(tooltipData)
        } else {
          model.setMouseoverExtraInformation(undefined)
        }

        if (model.highlightedFeatureIndex !== -1) {
          model.setHighlightedFeatureIndex(-1)
        }
        return
      }

      // Check for CIGAR items (they're drawn on top of reads)
      const cigarResolvedBlock = resolveBlockForCanvasX(canvasX)
      const cigarCoords2 = cigarResolvedBlock
        ? canvasToGenomicCoords(
            canvasX,
            canvasY,
            cigarResolvedBlock,
            featureHeightSetting,
            featureSpacing,
            showCoverage,
            coverageHeight,
            model.currentRangeY,
          )
        : undefined
      const cigarHit =
        cigarResolvedBlock && cigarCoords2
          ? hitTestCigarItemFn(
              cigarResolvedBlock,
              cigarCoords2,
              featureHeightSetting,
            )
          : undefined
      if (cigarHit) {
        setOverCigarItem(true)
        model.setMouseoverExtraInformation(formatCigarTooltip(cigarHit))

        // Still do feature hit test to keep highlight on underlying read
        const featureResolved1 = resolveBlockForCanvasX(canvasX)
        const featureCoords1 = featureResolved1
          ? canvasToGenomicCoords(
              canvasX,
              canvasY,
              featureResolved1,
              featureHeightSetting,
              featureSpacing,
              showCoverage,
              coverageHeight,
              model.currentRangeY,
            )
          : undefined
        const hit =
          featureResolved1 && featureCoords1
            ? hitTestFeatureFn(
                canvasX,
                canvasY,
                featureResolved1,
                featureCoords1,
                featureHeightSetting,
              )
            : undefined
        const featureId = hit?.id
        const featureIndex = hit?.index ?? -1
        model.setFeatureIdUnderMouse(featureId)
        if (model.highlightedFeatureIndex !== featureIndex) {
          model.setHighlightedFeatureIndex(featureIndex)
        }
        return
      }

      // Not over a CIGAR item or coverage
      setOverCigarItem(false)

      // Fall back to feature hit testing
      const featureResolved2 = resolveBlockForCanvasX(canvasX)
      const featureCoords2_2 = featureResolved2
        ? canvasToGenomicCoords(
            canvasX,
            canvasY,
            featureResolved2,
            featureHeightSetting,
            featureSpacing,
            showCoverage,
            coverageHeight,
            model.currentRangeY,
          )
        : undefined
      const hit =
        featureResolved2 && featureCoords2_2
          ? hitTestFeatureFn(
              canvasX,
              canvasY,
              featureResolved2,
              featureCoords2_2,
              featureHeightSetting,
            )
          : undefined
      const featureId = hit?.id
      const featureIndex = hit?.index ?? -1

      model.setFeatureIdUnderMouse(featureId)

      if (model.highlightedFeatureIndex !== featureIndex) {
        model.setHighlightedFeatureIndex(featureIndex)
      }

      // Set tooltip info
      if (featureId) {
        const info = model.getFeatureInfoById(featureId)
        if (info) {
          const tooltipText = `${info.name || info.id} ${info.refName}:${info.start.toLocaleString()}-${info.end.toLocaleString()} (${info.strand})`
          model.setMouseoverExtraInformation(tooltipText)
        } else {
          model.setMouseoverExtraInformation(undefined)
        }
      } else {
        model.setMouseoverExtraInformation(undefined)
      }
    },
    [
      showInterbaseIndicators,
      showSashimiArcs,
      model,
      handleMouseMove,
      resolveBlockForCanvasX,
      featureHeightSetting,
      featureSpacing,
      showCoverage,
      coverageHeight,
    ],
  )

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const coords = getCanvasCoords(e, canvasRef, canvasRectRef)
      if (!coords) {
        return
      }
      const { canvasX, canvasY } = coords

      // Check for indicator clicks first (triangles at top of coverage)
      const indicatorResolved = resolveBlockForCanvasX(canvasX)
      const indicatorHit = hitTestIndicatorFn(
        canvasX,
        canvasY,
        indicatorResolved,
        showCoverage,
        showInterbaseIndicators,
      )
      if (indicatorHit) {
        const blockHit = resolveBlockForCanvasX(canvasX)
        const refName = blockHit?.refName ?? model.loadedRegion?.refName ?? ''
        const blockRpcData = blockHit?.rpcData
        const posOffset =
          indicatorHit.position - (blockRpcData?.regionStart ?? 0)
        const tooltipBin = blockRpcData?.tooltipData[posOffset]

        const session = getSession(model)
        if (isSessionModelWithWidgets(session)) {
          const featureData: Record<string, unknown> = {
            uniqueId: `indicator-${indicatorHit.indicatorType}-${refName}-${indicatorHit.position}`,
            name: `Coverage ${CIGAR_TYPE_LABELS[indicatorHit.indicatorType] ?? indicatorHit.indicatorType}`,
            type: indicatorHit.indicatorType,
            refName,
            start: indicatorHit.position,
            end: indicatorHit.position + 1,
          }

          if (tooltipBin) {
            const interbaseEntry =
              tooltipBin.interbase[indicatorHit.indicatorType]
            if (interbaseEntry) {
              featureData.count = `${interbaseEntry.count}/${tooltipBin.depth}`
              featureData.size =
                interbaseEntry.minLen === interbaseEntry.maxLen
                  ? `${interbaseEntry.minLen}bp`
                  : `${interbaseEntry.minLen}-${interbaseEntry.maxLen}bp (avg ${interbaseEntry.avgLen.toFixed(1)}bp)`
              if (interbaseEntry.topSeq) {
                featureData.sequence = interbaseEntry.topSeq
              }
            }
            featureData.depth = tooltipBin.depth
          } else {
            const { counts } = indicatorHit
            featureData.count =
              counts.insertion + counts.softclip + counts.hardclip
          }

          const featureWidget = session.addWidget(
            'BaseFeatureWidget',
            'baseFeature',
            {
              featureData,
              view: getContainingView(model),
              track: getContainingTrack(model),
            },
          )
          session.showWidget(featureWidget)
        }
        return
      }

      // Check for coverage SNP clicks (significant SNPs in coverage bars)
      const coverageResolved = resolveBlockForCanvasX(canvasX)
      const coverageHit = hitTestCoverageFn(
        canvasX,
        canvasY,
        coverageResolved,
        showCoverage,
        coverageHeight,
      )
      if (coverageHit) {
        const blockHit = resolveBlockForCanvasX(canvasX)
        const refName = blockHit?.refName ?? model.loadedRegion?.refName ?? ''
        const blockRpcData = blockHit?.rpcData
        const posOffset =
          coverageHit.position - (blockRpcData?.regionStart ?? 0)
        const tooltipBin = blockRpcData?.tooltipData[posOffset]

        // Only open widget if there's meaningful data
        const hasSNPs = coverageHit.snps.some(
          s =>
            s.base === 'A' ||
            s.base === 'C' ||
            s.base === 'G' ||
            s.base === 'T',
        )
        const hasInterbase = coverageHit.snps.some(
          s =>
            s.base === 'insertion' ||
            s.base === 'softclip' ||
            s.base === 'hardclip',
        )
        if (hasSNPs || hasInterbase || tooltipBin) {
          const session = getSession(model)
          if (isSessionModelWithWidgets(session)) {
            const featureData: Record<string, unknown> = {
              uniqueId: `coverage-${refName}-${coverageHit.position}`,
              name: 'Coverage',
              type: 'coverage',
              refName,
              start: coverageHit.position,
              end: coverageHit.position + 1,
              depth: coverageHit.depth,
            }

            if (tooltipBin) {
              for (const [base, entry] of Object.entries(tooltipBin.snps)) {
                const snpEntry = entry as
                  | { count: number; fwd: number; rev: number }
                  | undefined
                if (snpEntry) {
                  featureData[`SNP ${base.toUpperCase()}`] =
                    `${snpEntry.count}/${tooltipBin.depth} (${snpEntry.fwd}(+) ${snpEntry.rev}(-))`
                }
              }
              for (const [type, entry] of Object.entries(
                tooltipBin.interbase,
              )) {
                const interbaseEntry = entry as
                  | {
                      count: number
                      minLen: number
                      maxLen: number
                      avgLen: number
                      topSeq?: string
                    }
                  | undefined
                if (interbaseEntry) {
                  featureData[type] =
                    `${interbaseEntry.count} (${interbaseEntry.minLen}-${interbaseEntry.maxLen}bp)`
                }
              }
            } else {
              for (const snp of coverageHit.snps) {
                featureData[snp.base] = snp.count
              }
            }

            const featureWidget = session.addWidget(
              'BaseFeatureWidget',
              'baseFeature',
              {
                featureData,
                view: getContainingView(model),
                track: getContainingTrack(model),
              },
            )
            session.showWidget(featureWidget)
          }
          return
        }
      }

      // Check for CIGAR item clicks (they're on top of reads)
      const cigarResolved = resolveBlockForCanvasX(canvasX)
      const cigarCoords = cigarResolved
        ? canvasToGenomicCoords(
            canvasX,
            canvasY,
            cigarResolved,
            featureHeightSetting,
            featureSpacing,
            showCoverage,
            coverageHeight,
            model.currentRangeY,
          )
        : undefined
      const cigarHit =
        cigarResolved && cigarCoords
          ? hitTestCigarItemFn(cigarResolved, cigarCoords, featureHeightSetting)
          : undefined
      if (cigarHit) {
        // Also get the feature hit to find the read ID
        const featureHit =
          cigarResolved && cigarCoords
            ? hitTestFeatureFn(
                canvasX,
                canvasY,
                cigarResolved,
                cigarCoords,
                featureHeightSetting,
              )
            : undefined
        const blockHit = resolveBlockForCanvasX(canvasX)
        const refName = blockHit?.refName ?? model.loadedRegion?.refName ?? ''

        if (featureHit) {
          model.setSelectedFeatureIndex(featureHit.index)
        }

        // Open widget with CIGAR item details
        const session = getSession(model)
        if (isSessionModelWithWidgets(session)) {
          const featureData: Record<string, unknown> = {
            uniqueId: `${cigarHit.type}-${refName}-${cigarHit.position}`,
            name: CIGAR_TYPE_LABELS[cigarHit.type] ?? cigarHit.type,
            type: cigarHit.type,
            refName,
            start: cigarHit.position,
            end: cigarHit.position + (cigarHit.length ?? 1),
          }

          // Add type-specific fields
          if (cigarHit.type === 'mismatch' && cigarHit.base) {
            featureData.base = cigarHit.base
          } else if (cigarHit.type === 'insertion') {
            featureData.length = cigarHit.length
            if (cigarHit.sequence) {
              featureData.sequence = cigarHit.sequence
            }
          } else if (cigarHit.type === 'deletion') {
            featureData.length = cigarHit.length
          } else if (cigarHit.type === 'skip') {
            featureData.length = cigarHit.length
          } else if (cigarHit.type === 'softclip') {
            featureData.length = cigarHit.length
          } else if (cigarHit.type === 'hardclip') {
            featureData.length = cigarHit.length
          }

          const featureWidget = session.addWidget(
            'BaseFeatureWidget',
            'baseFeature',
            {
              featureData,
              view: getContainingView(model),
              track: getContainingTrack(model),
            },
          )
          session.showWidget(featureWidget)
        }
        return
      }

      const featureResolved = resolveBlockForCanvasX(canvasX)
      const featureCoords = featureResolved
        ? canvasToGenomicCoords(
            canvasX,
            canvasY,
            featureResolved,
            featureHeightSetting,
            featureSpacing,
            showCoverage,
            coverageHeight,
            model.currentRangeY,
          )
        : undefined
      const hit =
        featureResolved && featureCoords
          ? hitTestFeatureFn(
              canvasX,
              canvasY,
              featureResolved,
              featureCoords,
              featureHeightSetting,
            )
          : undefined
      if (hit) {
        model.setSelectedFeatureIndex(hit.index)
        model.selectFeatureById(hit.id)
      } else {
        if (model.selectedFeatureIndex !== -1) {
          model.setSelectedFeatureIndex(-1)
        }
      }
    },
    [
      resolveBlockForCanvasX,
      featureHeightSetting,
      featureSpacing,
      showCoverage,
      coverageHeight,
      showInterbaseIndicators,
      model,
    ],
  )

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      const coords = getCanvasCoords(e, canvasRef, canvasRectRef)
      if (!coords) {
        return
      }
      const contextResolved = resolveBlockForCanvasX(coords.canvasX)
      const contextCoords = contextResolved
        ? canvasToGenomicCoords(
            coords.canvasX,
            coords.canvasY,
            contextResolved,
            featureHeightSetting,
            featureSpacing,
            showCoverage,
            coverageHeight,
            model.currentRangeY,
          )
        : undefined
      const hit =
        contextResolved && contextCoords
          ? hitTestFeatureFn(
              coords.canvasX,
              coords.canvasY,
              contextResolved,
              contextCoords,
              featureHeightSetting,
            )
          : undefined
      if (hit) {
        e.preventDefault()
        // For now, open feature widget on right-click (same as left-click)
        // TODO: implement proper context menu
        model.selectFeatureById(hit.id)
      }
    },
    [
      model,
      resolveBlockForCanvasX,
      featureHeightSetting,
      featureSpacing,
      showCoverage,
      coverageHeight,
    ],
  )

  // Coverage height resize handlers
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      resizeDragRef.current = {
        isDragging: true,
        startY: e.clientY,
        startHeight: coverageHeight,
      }

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!resizeDragRef.current.isDragging) {
          return
        }
        const deltaY = moveEvent.clientY - resizeDragRef.current.startY
        const newHeight = Math.max(
          20,
          resizeDragRef.current.startHeight + deltaY,
        )
        model.setCoverageHeight(newHeight)
      }

      const handleMouseUp = () => {
        resizeDragRef.current.isDragging = false
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [coverageHeight, model],
  )

  // Get visible range for label computation (triggers re-render on view change)
  const labelBpRange = getVisibleBpRange()

  // Compute visible deletion, insertion, softclip, hardclip, and mismatch labels
  const visibleLabels = useMemo(() => {
    const labels: {
      type: 'deletion' | 'insertion' | 'softclip' | 'hardclip' | 'mismatch'
      x: number
      y: number
      text: string
      width: number
    }[] = []

    if (
      !rpcData ||
      !labelBpRange ||
      width === undefined ||
      !showMismatches // Only show labels when mismatches are shown
    ) {
      return labels
    }

    const bpRange = labelBpRange

    const bpPerPx = (bpRange[1] - bpRange[0]) / width
    const pxPerBp = 1 / bpPerPx
    const charWidth = 6.5
    const canRenderText = pxPerBp >= charWidth
    const rowHeight = featureHeightSetting + featureSpacing
    const rangeY = model.currentRangeY
    const pileupYOffset = showCoverage ? coverageHeight : 0

    // Minimum pixel width needed to show a label (about 15px for short numbers like "5")
    const minLabelWidth = 15

    // Process deletions (gaps)
    const { gapPositions, gapYs, gapLengths, gapTypes, numGaps, regionStart } =
      rpcData
    for (let i = 0; i < numGaps; i++) {
      // Only show labels for deletions (type 0), not skips (type 1)
      if (gapTypes[i] !== 0) {
        continue
      }

      const startOffset = gapPositions[i * 2]!
      const endOffset = gapPositions[i * 2 + 1]!
      const length = gapLengths[i]!
      const y = gapYs[i]!

      // Convert to genomic coordinates
      const gapStart = regionStart + startOffset
      const gapEnd = regionStart + endOffset

      // Check if visible
      if (gapEnd < bpRange[0] || gapStart > bpRange[1]) {
        continue
      }

      // Calculate pixel positions
      const startPx = (gapStart - bpRange[0]) / bpPerPx
      const endPx = (gapEnd - bpRange[0]) / bpPerPx
      const widthPx = endPx - startPx

      // Only show label if wide enough
      if (widthPx < minLabelWidth) {
        continue
      }

      // Calculate Y position (center of feature)
      const yPx =
        y * rowHeight + featureHeightSetting / 2 - rangeY[0] + pileupYOffset

      // Skip if out of view vertically
      if (yPx < pileupYOffset || yPx > height) {
        continue
      }

      labels.push({
        type: 'deletion',
        x: (startPx + endPx) / 2,
        y: yPx,
        text: String(length),
        width: widthPx,
      })
    }

    // Process insertions
    const { insertionPositions, insertionYs, insertionLengths, numInsertions } =
      rpcData
    for (let i = 0; i < numInsertions; i++) {
      const posOffset = insertionPositions[i]!
      const length = insertionLengths[i]!
      const y = insertionYs[i]!

      // Convert to genomic coordinate
      const pos = regionStart + posOffset

      // Check if visible
      if (pos < bpRange[0] || pos > bpRange[1]) {
        continue
      }

      // Calculate pixel position
      const xPx = (pos - bpRange[0]) / bpPerPx

      // Calculate Y position (centered in feature)
      const yPx =
        y * rowHeight + featureHeightSetting / 2 - rangeY[0] + pileupYOffset

      // Skip if out of view vertically
      if (yPx < pileupYOffset || yPx > height) {
        continue
      }

      // Use helper to classify insertion type (matches shader logic)
      const insertionType = getInsertionType(length, pxPerBp)

      // Large insertions show the number centered on the box
      // Small insertions show "(length)" offset to the right when zoomed in
      if (insertionType === 'large') {
        labels.push({
          type: 'insertion',
          x: xPx,
          y: yPx,
          text: String(length),
          width: 0,
        })
      } else if (insertionType === 'small' && canRenderText) {
        labels.push({
          type: 'insertion',
          x: xPx + 3,
          y: yPx,
          text: `(${length})`,
          width: 0,
        })
      }
    }

    // Process soft clips
    const { softclipPositions, softclipYs, softclipLengths, numSoftclips } =
      rpcData
    if (canRenderText) {
      for (let i = 0; i < numSoftclips; i++) {
        const posOffset = softclipPositions[i]!
        const length = softclipLengths[i]!
        const y = softclipYs[i]!

        const pos = regionStart + posOffset

        if (pos < bpRange[0] || pos > bpRange[1]) {
          continue
        }

        const xPx = (pos - bpRange[0]) / bpPerPx
        const yPx =
          y * rowHeight + featureHeightSetting / 2 - rangeY[0] + pileupYOffset

        if (yPx < pileupYOffset || yPx > height) {
          continue
        }

        labels.push({
          type: 'softclip',
          x: xPx,
          y: yPx,
          text: `(S${length})`,
          width: 0,
        })
      }
    }

    // Process hard clips
    const { hardclipPositions, hardclipYs, hardclipLengths, numHardclips } =
      rpcData
    if (canRenderText) {
      for (let i = 0; i < numHardclips; i++) {
        const posOffset = hardclipPositions[i]!
        const length = hardclipLengths[i]!
        const y = hardclipYs[i]!

        const pos = regionStart + posOffset

        if (pos < bpRange[0] || pos > bpRange[1]) {
          continue
        }

        const xPx = (pos - bpRange[0]) / bpPerPx
        const yPx =
          y * rowHeight + featureHeightSetting / 2 - rangeY[0] + pileupYOffset

        if (yPx < pileupYOffset || yPx > height) {
          continue
        }

        labels.push({
          type: 'hardclip',
          x: xPx,
          y: yPx,
          text: `(H${length})`,
          width: 0,
        })
      }
    }

    // Process mismatches - show base letter when zoomed in enough
    const { mismatchPositions, mismatchYs, mismatchBases, numMismatches } =
      rpcData
    if (canRenderText) {
      for (let i = 0; i < numMismatches; i++) {
        const posOffset = mismatchPositions[i]!
        const baseCode = mismatchBases[i]!
        const y = mismatchYs[i]!

        const pos = regionStart + posOffset

        if (pos < bpRange[0] || pos + 1 > bpRange[1]) {
          continue
        }

        // Center text in the 1bp mismatch rectangle
        const startPx = (pos - bpRange[0]) / bpPerPx
        const endPx = (pos + 1 - bpRange[0]) / bpPerPx
        const xPx = (startPx + endPx) / 2

        const yPx =
          y * rowHeight + featureHeightSetting / 2 - rangeY[0] + pileupYOffset

        if (yPx < pileupYOffset || yPx > height) {
          continue
        }

        labels.push({
          type: 'mismatch',
          x: xPx,
          y: yPx,
          text: String.fromCharCode(baseCode),
          width: endPx - startPx,
        })
      }
    }

    return labels
  }, [
    rpcData,
    labelBpRange,
    width,
    height,
    featureHeightSetting,
    featureSpacing,
    showMismatches,
    showCoverage,
    coverageHeight,
    model,
  ])

  // Always render the canvas so the WebGL renderer stays attached to the
  // same DOM element. Overlay error/too-large messages on top instead of
  // replacing the canvas (which would leave the renderer pointing at a
  // detached node after Force Load).
  const showBanner = !!error || model.regionTooLarge

  useEffect(() => {
    if (showBanner) {
      model.setFeatureIdUnderMouse(undefined)
      model.setMouseoverExtraInformation(undefined)
    }
  }, [showBanner, model])

  if (showBanner) {
    return (
      <div
        ref={measureRef}
        style={{ position: 'relative', width: '100%', height }}
      >
        <canvas
          ref={canvasRef}
          width={0}
          height={0}
          style={{ display: 'none' }}
        />
        {error ? (
          <BlockMsg severity="error" message={error.message} />
        ) : (
          <TooLargeMessage model={model} />
        )}
      </div>
    )
  }

  return (
    <div
      ref={measureRef}
      style={{ position: 'relative', width: '100%', height }}
    >
      <canvas
        ref={canvasRef}
        width={width ?? 800}
        height={height}
        style={{
          display: 'block',
          width: width ?? '100%',
          height,
          cursor:
            model.featureIdUnderMouse || overCigarItem ? 'pointer' : 'default',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      />

      {visibleLabels.length > 0 ? (
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: width ?? '100%',
            height,
            pointerEvents: 'none',
            overflow: 'hidden',
          }}
        >
          {visibleLabels.map((label, i) => {
            const isSmallInterbase =
              (label.type === 'insertion' ||
                label.type === 'softclip' ||
                label.type === 'hardclip') &&
              label.text.startsWith('(')
            const interbaseColorMap: Record<string, string> = {
              insertion: '#800080',
              softclip: '#0000ff',
              hardclip: '#ff0000',
            }
            let fillColor = '#fff'
            if (isSmallInterbase) {
              fillColor = interbaseColorMap[label.type] ?? '#800080'
            } else if (label.type === 'mismatch') {
              fillColor = contrastMap[label.text] ?? '#fff'
            }
            return (
              <text
                key={`${label.type}-${i}`}
                x={label.x}
                y={label.y}
                textAnchor={isSmallInterbase ? 'start' : 'middle'}
                dominantBaseline="central"
                fontSize={label.type === 'mismatch' ? 9 : 10}
                fontFamily="sans-serif"
                fontWeight="bold"
                fill={fillColor}
              >
                {label.text}
              </text>
            )
          })}
        </svg>
      ) : null}

      {model.coverageTicks ? (
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents: 'none',
            height: model.coverageTicks.height,
            width: 50,
          }}
        >
          <g transform="translate(45, 0)">
            <CoverageYScaleBar model={model} orientation="left" />
          </g>
        </svg>
      ) : null}

      {showCoverage ? (
        <div
          onMouseDown={handleResizeMouseDown}
          onMouseEnter={() => {
            setResizeHandleHovered(true)
          }}
          onMouseLeave={() => {
            setResizeHandleHovered(false)
          }}
          style={{
            position: 'absolute',
            top: coverageHeight - YSCALEBAR_LABEL_OFFSET,
            left: 0,
            right: 0,
            height: YSCALEBAR_LABEL_OFFSET,
            cursor: 'row-resize',
            background: resizeHandleHovered ? 'rgba(0,0,0,0.1)' : 'transparent',
            zIndex: 10,
          }}
          title="Drag to resize coverage track"
        />
      ) : null}

      <LoadingOverlay
        statusMessage={statusMessage}
        isVisible={model.showLoading}
      />
    </div>
  )
})

export default WebGLAlignmentsComponent
