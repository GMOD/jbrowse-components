import { useCallback, useEffect, useId, useRef, useState } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import useMeasure from '@jbrowse/core/util/useMeasure'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import { getCoordinator, removeCoordinator } from './ViewCoordinator.ts'
import { WebGLRenderer } from './WebGLRenderer.ts'

import type { WebGLPileupDataResult } from '../../RenderWebGLPileupDataRPC/types.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

interface LinearWebGLPileupDisplayModel {
  height: number
  rpcData: WebGLPileupDataResult | null
  loadedRegion: { refName: string; start: number; end: number } | null
  isLoading: boolean
  error: Error | null
  featureHeight: number
  featureSpacing: number
  colorSchemeIndex: number
  showCoverage: boolean
  coverageHeight: number
  showMismatches: boolean
  showInterbaseCounts: boolean
  showInterbaseIndicators: boolean
  maxY: number
  setMaxY: (y: number) => void
  setCurrentDomain: (domain: [number, number]) => void
  handleNeedMoreData: (region: { start: number; end: number }) => void
}

export interface Props {
  model: LinearWebGLPileupDisplayModel
}

/**
 * WebGL Pileup Component
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

// Debug logging - set to true to diagnose performance issues
const DEBUG = false
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, no-console, @typescript-eslint/no-confusing-void-expression
const log = (...args: unknown[]) => DEBUG && console.log('[WebGL]', ...args)
const renderCountRef = { current: 0 }
const wheelCountRef = { current: 0 }
const immediateRenderCountRef = { current: 0 }
const scheduledRenderCountRef = { current: 0 }

const WebGLPileupComponent = observer(function WebGLPileupComponent({
  model,
}: Props) {
  renderCountRef.current++
  log(`RENDER #${renderCountRef.current}`)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<WebGLRenderer | null>(null)
  const canvasId = useId()

  // Use ResizeObserver via useMeasure for passive dimension tracking
  // This avoids forced layout from reading clientWidth/clientHeight
  const [measureRef, measuredDims] = useMeasure()

  // Y-axis scroll state (not part of view)
  const rangeYRef = useRef<[number, number]>([0, 600])

  const [maxY, setMaxY] = useState(0)
  const [rendererReady, setRendererReady] = useState(false)

  // Rendering and data loading
  const renderRAFRef = useRef<number | null>(null)
  const scheduleRenderRef = useRef<() => void>(() => {})
  // Flag to skip effect when we triggered the update ourselves
  const selfUpdateRef = useRef(false)
  const pendingDataRequestRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )
  const lastRequestedRegionRef = useRef<{ start: number; end: number } | null>(
    null,
  )

  // Drag state
  const dragRef = useRef({
    isDragging: false,
    lastX: 0,
  })

  // Cache canvas bounding rect to avoid forced layout on every wheel event
  const canvasRectRef = useRef<DOMRect | null>(null)

  const view = getContainingView(model) as LinearGenomeViewModel | undefined
  const viewId = view?.id

  const {
    rpcData,
    isLoading,
    error,
    featureHeight,
    featureSpacing,
    colorSchemeIndex,
    showCoverage,
    coverageHeight,
    showMismatches,
    showInterbaseCounts,
    showInterbaseIndicators,
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

  // Compute visible range directly from view state - this is the single source of truth
  // Returns null if view is not ready
  const getVisibleBpRange = useCallback((): [number, number] | null => {
    if (!view?.initialized || width === undefined) {
      return null
    }

    const dynamicBlocks = (view as unknown as { dynamicBlocks?: { contentBlocks?: { refName: string; start: number; end: number; offsetPx?: number }[] } }).dynamicBlocks
    const contentBlocks = dynamicBlocks?.contentBlocks as
      | { refName: string; start: number; end: number; offsetPx?: number }[]
      | undefined
    if (!contentBlocks || contentBlocks.length === 0) {
      return null
    }
    const first = contentBlocks[0]
    const last = contentBlocks[contentBlocks.length - 1]
    if (!first || first.refName !== last?.refName) {
      // Multi-ref view - not supported yet
      return null
    }

    // Compute visible range from view's coordinate system
    // This matches exactly how gridlines compute positions
    const bpPerPx = view.bpPerPx
    const blockOffsetPx = first.offsetPx ?? 0
    const deltaPx = view.offsetPx - blockOffsetPx
    const deltaBp = deltaPx * bpPerPx

    const rangeStart = first.start + deltaBp
    const rangeEnd = rangeStart + width * bpPerPx
    return [rangeStart, rangeEnd]
  }, [view, width])

  // Render to WebGL canvas with explicit domain - used for immediate rendering
  // during interaction without waiting for MobX reaction
  const renderWithDomain = useCallback(
    (domainX: [number, number], canvasW?: number) => {
      immediateRenderCountRef.current++
      const renderNum = immediateRenderCountRef.current
      const t0 = performance.now()
      const w = canvasW ?? width
      if (!rendererRef.current || w === undefined) {
        log(`IMMEDIATE RENDER #${renderNum} SKIP - no renderer or width`)
        return
      }

      const t1 = performance.now()
      rendererRef.current.render({
        domainX,
        rangeY: rangeYRef.current,
        colorScheme: colorSchemeIndex,
        featureHeight,
        featureSpacing,
        showCoverage,
        coverageHeight,
        showMismatches,
        showInterbaseCounts,
        showInterbaseIndicators,
        canvasWidth: w,
        canvasHeight: height,
      })
      const t2 = performance.now()
      log(
        `IMMEDIATE RENDER #${renderNum}: setup=${(t1 - t0).toFixed(2)}ms, WebGL=${(t2 - t1).toFixed(2)}ms, total=${(t2 - t0).toFixed(2)}ms`,
      )
    },
    [
      colorSchemeIndex,
      featureHeight,
      featureSpacing,
      showCoverage,
      coverageHeight,
      showMismatches,
      showInterbaseCounts,
      showInterbaseIndicators,
      width,
      height,
    ],
  )

  // Render to WebGL canvas - reads domain from MobX view state (used by scheduled renders)
  const renderNow = useCallback(() => {
    const t0 = performance.now()
    const visibleBpRange = getVisibleBpRange()
    if (!visibleBpRange) {
      log('renderNow (scheduled) SKIP - no visible range')
      return
    }
    log(
      `renderNow (scheduled) calling renderWithDomain, getVisibleBpRange took ${(performance.now() - t0).toFixed(2)}ms`,
    )
    renderWithDomain(visibleBpRange)
  }, [getVisibleBpRange, renderWithDomain])

  const scheduleRender = useCallback(() => {
    scheduledRenderCountRef.current++
    const schedNum = scheduledRenderCountRef.current
    log(`SCHEDULE RENDER #${schedNum} requested`)
    if (renderRAFRef.current !== null) {
      log(`SCHEDULE RENDER #${schedNum} - canceling previous RAF`)
      cancelAnimationFrame(renderRAFRef.current)
    }
    renderRAFRef.current = requestAnimationFrame(() => {
      renderRAFRef.current = null
      log(`SCHEDULE RENDER #${schedNum} - RAF callback firing`)
      renderNow()
    })
  }, [renderNow])

  // Keep refs updated for use in event handlers without causing effect re-runs
  scheduleRenderRef.current = scheduleRender

  // Check if more data needs to be loaded
  const checkDataNeeds = useCallback(() => {
    const visibleBpRange = getVisibleBpRange()
    if (!visibleBpRange) {
      return
    }
    const loadedRegion = model.loadedRegion
    if (!loadedRegion || model.isLoading) {
      return
    }

    const buffer = (visibleBpRange[1] - visibleBpRange[0]) * 0.5
    const needsData =
      visibleBpRange[0] - buffer < loadedRegion.start ||
      visibleBpRange[1] + buffer > loadedRegion.end

    if (needsData) {
      if (pendingDataRequestRef.current) {
        clearTimeout(pendingDataRequestRef.current)
      }
      pendingDataRequestRef.current = setTimeout(() => {
        if (model.isLoading) {
          return
        }
        const currentRange = getVisibleBpRange()
        if (!currentRange) {
          return
        }
        const requested = lastRequestedRegionRef.current
        if (
          requested &&
          currentRange[0] >= requested.start &&
          currentRange[1] <= requested.end
        ) {
          return
        }
        lastRequestedRegionRef.current = {
          start: currentRange[0],
          end: currentRange[1],
        }
        model.handleNeedMoreData({
          start: currentRange[0],
          end: currentRange[1],
        })
        pendingDataRequestRef.current = null
      }, 200)
    }
  }, [getVisibleBpRange, model])

  // Refs for callbacks and values used in wheel/mouse handlers - prevents effect churn
  // Must be defined after the callbacks they reference
  const renderNowRef = useRef(renderNow)
  renderNowRef.current = renderNow
  const renderWithDomainRef = useRef(renderWithDomain)
  renderWithDomainRef.current = renderWithDomain
  const checkDataNeedsRef = useRef(checkDataNeeds)
  checkDataNeedsRef.current = checkDataNeeds
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
    log('EFFECT: Initialize WebGL - RUN')
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
      log('EFFECT: Initialize WebGL - CLEANUP')
      rendererRef.current?.destroy()
      rendererRef.current = null
      setRendererReady(false)
    }
  }, [])

  // Subscribe to coordinator for cross-canvas sync
  // When another canvas in the same view updates, re-render
  useEffect(() => {
    log(`EFFECT: Coordinator subscribe - RUN (viewId=${viewId})`)
    if (!viewId) {
      return
    }
    const coordinator = getCoordinator(viewId)
    const unsubscribe = coordinator.subscribe(canvasId, () => {
      // Just trigger a re-render - we always read from view state
      renderNow()
    })
    return () => {
      log('EFFECT: Coordinator subscribe - CLEANUP')
      unsubscribe()
      if (coordinator.listenerCount === 0) {
        removeCoordinator(viewId)
      }
    }
  }, [viewId, canvasId, renderNow])

  // Re-render when view state changes (pan/zoom from any source)
  // Uses MobX autorun for more predictable timing than useEffect
  // This handles external navigation (keyboard, clicks) but skips our own setNewView calls
  useEffect(() => {
    if (!view) {
      return
    }

    const dispose = autorun(() => {
      const t0 = performance.now()
      // Access observables to subscribe to them
      const offsetPx = view.offsetPx
      const bpPerPx = view.bpPerPx
      const initialized = view.initialized

      // Skip if we triggered this update ourselves (already rendered immediately)
      if (selfUpdateRef.current) {
        log(
          `AUTORUN: View state change - SKIP (self-triggered, offsetPx=${offsetPx.toFixed(
            2,
          )}, bpPerPx=${bpPerPx.toFixed(4)})`,
        )
        selfUpdateRef.current = false
        return
      }

      log(
        `AUTORUN: View state change - RUN (external, offsetPx=${offsetPx.toFixed(
          2,
        )}, bpPerPx=${bpPerPx.toFixed(4)})`,
      )

      if (!initialized) {
        return
      }

      // Sync domain to model for data loading
      const visibleBpRange = getVisibleBpRangeRef.current()
      if (visibleBpRange) {
        model.setCurrentDomain(visibleBpRange)
      }

      // Render immediately for external navigation
      renderNowRef.current()
      log(
        'AUTORUN: View state change - rendered in',
        `${(performance.now() - t0).toFixed(2)}ms`,
      )
    })

    return () => {
      log('AUTORUN: View state change - DISPOSE')
      dispose()
    }
  }, [view, model])

  // Upload features to GPU from RPC typed arrays
  useEffect(() => {
    if (!rendererRef.current || !rpcData || rpcData.numReads === 0) {
      return
    }

    // Use zero-copy upload path from RPC worker data
    // Positions are offsets from regionStart for Float32 precision
    rendererRef.current.uploadFromTypedArrays({
      regionStart: rpcData.regionStart,
      readPositions: rpcData.readPositions,
      readYs: rpcData.readYs,
      readFlags: rpcData.readFlags,
      readMapqs: rpcData.readMapqs,
      readInsertSizes: rpcData.readInsertSizes,
      numReads: rpcData.numReads,
      maxY: rpcData.maxY,
    })
    setMaxY(rpcData.maxY)
    model.setMaxY(rpcData.maxY)

    // Upload CIGAR data
    rendererRef.current.uploadCigarFromTypedArrays({
      gapPositions: rpcData.gapPositions,
      gapYs: rpcData.gapYs,
      numGaps: rpcData.numGaps,
      mismatchPositions: rpcData.mismatchPositions,
      mismatchYs: rpcData.mismatchYs,
      mismatchBases: rpcData.mismatchBases,
      numMismatches: rpcData.numMismatches,
      insertionPositions: rpcData.insertionPositions,
      insertionYs: rpcData.insertionYs,
      insertionLengths: rpcData.insertionLengths,
      numInsertions: rpcData.numInsertions,
      softclipPositions: rpcData.softclipPositions,
      softclipYs: rpcData.softclipYs,
      softclipLengths: rpcData.softclipLengths,
      numSoftclips: rpcData.numSoftclips,
      hardclipPositions: rpcData.hardclipPositions,
      hardclipYs: rpcData.hardclipYs,
      hardclipLengths: rpcData.hardclipLengths,
      numHardclips: rpcData.numHardclips,
    })

    scheduleRenderRef.current()
  }, [rpcData, model])

  // Upload coverage from RPC typed arrays
  useEffect(() => {
    if (!rendererRef.current || !showCoverage || !rpcData) {
      return
    }
    rendererRef.current.uploadCoverageFromTypedArrays({
      coverageDepths: rpcData.coverageDepths,
      coverageMaxDepth: rpcData.coverageMaxDepth,
      coverageBinSize: rpcData.coverageBinSize,
      numCoverageBins: rpcData.numCoverageBins,
      snpPositions: rpcData.snpPositions,
      snpYOffsets: rpcData.snpYOffsets,
      snpHeights: rpcData.snpHeights,
      snpColorTypes: rpcData.snpColorTypes,
      numSnpSegments: rpcData.numSnpSegments,
      // Noncov (interbase) coverage data
      noncovPositions: rpcData.noncovPositions,
      noncovYOffsets: rpcData.noncovYOffsets,
      noncovHeights: rpcData.noncovHeights,
      noncovColorTypes: rpcData.noncovColorTypes,
      noncovMaxCount: rpcData.noncovMaxCount,
      numNoncovSegments: rpcData.numNoncovSegments,
      // Indicator data
      indicatorPositions: rpcData.indicatorPositions,
      indicatorColorTypes: rpcData.indicatorColorTypes,
      numIndicators: rpcData.numIndicators,
    })
    scheduleRenderRef.current()
  }, [rpcData, showCoverage])

  // Re-render on settings change
  useEffect(() => {
    log('EFFECT: Settings change - RUN')
    if (rendererReady) {
      scheduleRenderRef.current()
    }
  }, [
    rendererReady,
    colorSchemeIndex,
    featureHeight,
    featureSpacing,
    showCoverage,
    coverageHeight,
    showMismatches,
    showInterbaseCounts,
    showInterbaseIndicators,
    rpcData,
  ])

  // Re-render when container dimensions change (from ResizeObserver)
  useEffect(() => {
    log(`EFFECT: Dimensions change - RUN (width=${measuredDims.width})`)
    if (rendererReady && measuredDims.width !== undefined) {
      scheduleRenderRef.current()
    }
  }, [rendererReady, measuredDims.width, measuredDims.height])

  // Reset data request tracking
  useEffect(() => {
    lastRequestedRegionRef.current = null
  }, [model.loadedRegion])

  // Cleanup
  useEffect(() => {
    return () => {
      if (pendingDataRequestRef.current) {
        clearTimeout(pendingDataRequestRef.current)
      }
      if (renderRAFRef.current) {
        cancelAnimationFrame(renderRAFRef.current)
      }
    }
  }, [])

  // Invalidate cached rect when container resizes
  useEffect(() => {
    log('EFFECT: Invalidate rect - RUN')
    canvasRectRef.current = null
  }, [measuredDims.width, measuredDims.height])

  // Refs for values used in wheel handler that we don't want as dependencies
  const maxYRef = useRef(maxY)
  maxYRef.current = maxY
  const featureHeightRef = useRef(featureHeight)
  featureHeightRef.current = featureHeight
  const featureSpacingRef = useRef(featureSpacing)
  featureSpacingRef.current = featureSpacing

  // Wheel handler for zoom and pan
  // Updates view state directly - this is the single source of truth
  // Effect runs once on mount - all values accessed via refs
  useEffect(() => {
    log('EFFECT: Wheel handler - RUN')
    const canvas = canvasRef.current
    if (!canvas) {
      log('EFFECT: Wheel handler - SKIP (no canvas)')
      return
    }

    const handleWheel = (e: WheelEvent) => {
      wheelCountRef.current++
      const wheelNum = wheelCountRef.current
      const t0 = performance.now()
      const view = viewRef.current
      const width = widthRef.current

      if (!view?.initialized || width === undefined) {
        log(`WHEEL #${wheelNum} SKIP - view not ready`)
        return
      }

      e.preventDefault()
      e.stopPropagation()

      const absX = Math.abs(e.deltaX)
      const absY = Math.abs(e.deltaY)

      // Horizontal scroll - pan
      if (absX > 5 && absX > absY * 2) {
        const t1 = performance.now()
        const newOffsetPx = clampOffsetRef.current(view.offsetPx + e.deltaX)

        // Compute new domain for immediate rendering
        const contentBlocks = (view as unknown as { dynamicBlocks?: { contentBlocks?: { refName: string; start: number; end: number; offsetPx?: number }[] } }).dynamicBlocks
          ?.contentBlocks as
          | { refName: string; start: number; end: number; offsetPx?: number }[]
          | undefined
        const first = contentBlocks?.[0]
        if (first) {
          const blockOffsetPx = first.offsetPx ?? 0
          const deltaPx = newOffsetPx - blockOffsetPx
          const deltaBp = deltaPx * view.bpPerPx
          const rangeStart = first.start + deltaBp
          const rangeEnd = rangeStart + width * view.bpPerPx
          const t2 = performance.now()

          // Render immediately with computed values
          renderWithDomainRef.current([rangeStart, rangeEnd])
          const t3 = performance.now()

          // Update MobX (for gridlines, other components)
          selfUpdateRef.current = true
          view.setNewView(view.bpPerPx, newOffsetPx)
          const t4 = performance.now()

          log(
            `WHEEL #${wheelNum} (pan): compute=${(t2 - t1).toFixed(2)}ms, render=${(t3 - t2).toFixed(2)}ms, setNewView=${(t4 - t3).toFixed(2)}ms, total=${(t4 - t0).toFixed(2)}ms`,
          )
        }

        checkDataNeedsRef.current()
        return
      }

      if (absY < 1) {
        return
      }

      if (e.shiftKey) {
        // Vertical scroll within pileup (Y-axis panning, not part of view state)
        const t1 = performance.now()
        const rowHeight = featureHeightRef.current + featureSpacingRef.current
        const totalHeight = maxYRef.current * rowHeight
        const panAmount = e.deltaY * 0.5

        const prev = rangeYRef.current
        let newY: [number, number] = [prev[0] + panAmount, prev[1] + panAmount]
        if (newY[0] < 0) {
          newY = [0, newY[1] - newY[0]]
        }
        if (newY[1] > totalHeight + 50) {
          const overflow = newY[1] - totalHeight - 50
          newY = [newY[0] - overflow, newY[1] - overflow]
        }
        rangeYRef.current = newY
        const t2 = performance.now()
        renderNowRef.current()
        const t3 = performance.now()
        log(
          `WHEEL #${wheelNum} (Y-pan): compute=${(t2 - t1).toFixed(2)}ms, render=${(t3 - t2).toFixed(2)}ms, total=${(t3 - t0).toFixed(2)}ms`,
        )
      } else {
        // Zoom around mouse position
        const t1 = performance.now()
        const currentRange = getVisibleBpRangeRef.current()
        if (!currentRange) {
          log(`WHEEL #${wheelNum} (zoom) SKIP - no current range`)
          return
        }

        // Use cached rect to avoid forced layout on every wheel event
        // Lazy init on first interaction if RAF hasn't fired yet
        let rect = canvasRectRef.current
        if (!rect) {
          rect = canvas.getBoundingClientRect()
          canvasRectRef.current = rect
          log(`WHEEL #${wheelNum} - getBoundingClientRect called (cache miss)`)
        }
        const mouseX = e.clientX - rect.left
        const factor = 1.2
        const zoomFactor = e.deltaY > 0 ? factor : 1 / factor

        // Calculate genomic position under mouse
        const rangeWidth = currentRange[1] - currentRange[0]
        const mouseFraction = mouseX / width
        const mouseBp = currentRange[0] + rangeWidth * mouseFraction

        // Calculate new zoom level
        const newRangeWidth = rangeWidth * zoomFactor
        const newBpPerPx = newRangeWidth / width

        // Check zoom limits
        if (newBpPerPx < view.minBpPerPx || newBpPerPx > view.maxBpPerPx) {
          log(`WHEEL #${wheelNum} (zoom) SKIP - zoom limit reached`)
          return
        }

        // Position new range so mouseBp stays at same screen position
        const newRangeStart = mouseBp - mouseFraction * newRangeWidth
        const newRangeEnd = newRangeStart + newRangeWidth
        const t2 = performance.now()

        // Compute new offsetPx from the new range start
        const contentBlocks = (view as unknown as { dynamicBlocks?: { contentBlocks?: { refName: string; start: number; end: number; offsetPx?: number }[] } }).dynamicBlocks
          ?.contentBlocks as
          | { refName: string; start: number; end: number; offsetPx?: number }[]
          | undefined
        const first = contentBlocks?.[0]
        if (first) {
          const blockOffsetPx = first.offsetPx ?? 0
          // assemblyOrigin is fixed - compute it from current state
          const assemblyOrigin = first.start - blockOffsetPx * view.bpPerPx
          const newOffsetPx = (newRangeStart - assemblyOrigin) / newBpPerPx

          // Render immediately with computed values
          renderWithDomainRef.current([newRangeStart, newRangeEnd])
          const t3 = performance.now()

          // Update MobX (for gridlines, other components)
          selfUpdateRef.current = true
          view.setNewView(newBpPerPx, newOffsetPx)
          const t4 = performance.now()

          log(
            `WHEEL #${wheelNum} (zoom): compute=${(t2 - t1).toFixed(2)}ms, render=${(t3 - t2).toFixed(2)}ms, setNewView=${(t4 - t3).toFixed(2)}ms, total=${(t4 - t0).toFixed(2)}ms`,
          )
        }

        checkDataNeedsRef.current()
      }
    }

    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      log('EFFECT: Wheel handler - CLEANUP')
      canvas.removeEventListener('wheel', handleWheel)
    }
    // All values accessed via refs - effect only runs once on mount
  }, [])

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

    // Horizontal pan - update view and render immediately
    if (dx !== 0) {
      const newOffsetPx = clampOffsetRef.current(view.offsetPx - dx)

      // Compute new domain for immediate rendering
      const contentBlocks = (view as unknown as { dynamicBlocks?: { contentBlocks?: { refName: string; start: number; end: number; offsetPx?: number }[] } }).dynamicBlocks
        ?.contentBlocks as
        | { refName: string; start: number; end: number; offsetPx?: number }[]
        | undefined
      const first = contentBlocks?.[0]
      if (first) {
        const blockOffsetPx = first.offsetPx ?? 0
        const deltaPx = newOffsetPx - blockOffsetPx
        const deltaBp = deltaPx * view.bpPerPx
        const rangeStart = first.start + deltaBp
        const rangeEnd = rangeStart + width * view.bpPerPx

        // Render immediately with computed values
        renderWithDomainRef.current([rangeStart, rangeEnd])

        // Update MobX (for gridlines, other components)
        selfUpdateRef.current = true
        view.setNewView(view.bpPerPx, newOffsetPx)
      }

      checkDataNeedsRef.current()
    }
  }, [])

  const handleMouseUp = useCallback(() => {
    dragRef.current.isDragging = false
  }, [])

  const handleMouseLeave = useCallback(() => {
    dragRef.current.isDragging = false
  }, [])

  if (error) {
    return (
      <div style={{ color: '#c00', padding: 16 }}>Error: {error.message}</div>
    )
  }

  const visibleBpRange = getVisibleBpRange()
  const isReady = width !== undefined && visibleBpRange !== null

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
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />

      {(isLoading || !isReady) && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(255,255,255,0.9)',
            padding: '8px 16px',
            borderRadius: 4,
          }}
        >
          {isLoading ? 'Loading features...' : 'Initializing...'}
        </div>
      )}
    </div>
  )
})

export default WebGLPileupComponent
