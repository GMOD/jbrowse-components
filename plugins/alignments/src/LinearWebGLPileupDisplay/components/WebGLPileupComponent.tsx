import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

import {
  getContainingTrack,
  getContainingView,
  getSession,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import useMeasure from '@jbrowse/core/util/useMeasure'
import { useTheme } from '@mui/material'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import { fillColor } from '../../shared/color.ts'
import { getContrastBaseMap } from '../../shared/util.ts'
import {
  YSCALEBAR_LABEL_OFFSET,
  getInsertionRectWidthPx,
  getInsertionType,
  textWidthForNumber,
} from '../model.ts'
import CoverageYScaleBar from './CoverageYScaleBar.tsx'
import { getCoordinator, removeCoordinator } from './ViewCoordinator.ts'
import { WebGLRenderer } from './WebGLRenderer.ts'

import type { CoverageTicks } from './CoverageYScaleBar.tsx'
import type { ColorPalette, RGBColor } from './WebGLRenderer.ts'
import type { WebGLPileupDataResult } from '../../RenderWebGLPileupDataRPC/types.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { Theme } from '@mui/material'

/**
 * Parse a CSS color string to RGB values (0-1 range)
 */
function parseColorToRGB(color: string): RGBColor {
  if (color.startsWith('#')) {
    let hex = color.slice(1)
    if (hex.length === 3) {
      hex = hex[0]! + hex[0]! + hex[1]! + hex[1]! + hex[2]! + hex[2]!
    }
    const r = parseInt(hex.slice(0, 2), 16) / 255
    const g = parseInt(hex.slice(2, 4), 16) / 255
    const b = parseInt(hex.slice(4, 6), 16) / 255
    return [r, g, b]
  }
  const namedColors: Record<string, RGBColor> = {
    lightgrey: [0.827, 0.827, 0.827],
    teal: [0, 0.502, 0.502],
    green: [0, 0.502, 0],
    grey: [0.502, 0.502, 0.502],
    blue: [0, 0, 1],
    red: [1, 0, 0],
    purple: [0.502, 0, 0.502],
  }
  const lower = color.toLowerCase()
  return namedColors[lower] ?? [0.5, 0.5, 0.5]
}

/**
 * Build a ColorPalette from the MUI theme
 */
function buildColorPaletteFromTheme(theme: Theme): ColorPalette {
  const { palette } = theme
  return {
    // Read/alignment colors from shared/color.ts
    colorFwdStrand: parseColorToRGB(fillColor.color_fwd_strand),
    colorRevStrand: parseColorToRGB(fillColor.color_rev_strand),
    colorNostrand: parseColorToRGB(fillColor.color_nostrand),
    colorPairLR: parseColorToRGB(fillColor.color_pair_lr),
    colorPairRL: parseColorToRGB(fillColor.color_pair_rl),
    colorPairRR: parseColorToRGB(fillColor.color_pair_rr),
    colorPairLL: parseColorToRGB(fillColor.color_pair_ll),
    // Base colors from theme
    colorBaseA: parseColorToRGB(palette.bases.A.main),
    colorBaseC: parseColorToRGB(palette.bases.C.main),
    colorBaseG: parseColorToRGB(palette.bases.G.main),
    colorBaseT: parseColorToRGB(palette.bases.T.main),
    // Indel/clip colors from theme
    colorInsertion: parseColorToRGB(palette.insertion),
    colorDeletion: parseColorToRGB(palette.deletion),
    colorSkip: parseColorToRGB(palette.skip),
    colorSoftclip: parseColorToRGB(palette.softclip),
    colorHardclip: parseColorToRGB(palette.hardclip),
    // Coverage color (light grey)
    colorCoverage: [0.8, 0.8, 0.8],
  }
}

interface FeatureInfo {
  id: string
  start: number
  end: number
  flags: number | undefined
  mapq: number | undefined
  strand: string
  refName: string
}

// Types for CIGAR item hit testing
type CigarItemType =
  | 'mismatch'
  | 'insertion'
  | 'deletion'
  | 'skip'
  | 'softclip'
  | 'hardclip'

interface CigarHitResult {
  type: CigarItemType
  index: number
  position: number // genomic position
  length?: number
  base?: string // for mismatches
  sequence?: string // for insertions
}

const CIGAR_TYPE_LABELS: Record<string, string> = {
  mismatch: 'SNP/Mismatch',
  insertion: 'Insertion',
  deletion: 'Deletion',
  skip: 'Skip (Intron)',
  softclip: 'Soft Clip',
  hardclip: 'Hard Clip',
}

// Types for coverage area hit testing
export interface CoverageHitResult {
  type: 'coverage'
  position: number // genomic position
  depth: number
  snps: { base: string; count: number }[] // SNP counts at this position
}

// Types for indicator hit testing
export interface IndicatorHitResult {
  type: 'indicator'
  position: number // genomic position
  indicatorType: 'insertion' | 'softclip' | 'hardclip'
  counts: { insertion: number; softclip: number; hardclip: number }
}

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
  featureIdUnderMouse: string | undefined
  coverageTicks?: CoverageTicks
  setMaxY: (y: number) => void
  setCurrentDomain: (domain: [number, number]) => void
  setCoverageHeight: (height: number) => void
  handleNeedMoreData: (region: { start: number; end: number }) => void
  setFeatureIdUnderMouse: (id: string | undefined) => void
  setMouseoverExtraInformation: (info: string | undefined) => void
  selectFeatureById: (featureId: string) => void
  getFeatureInfoById: (featureId: string) => FeatureInfo | undefined
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

const WebGLPileupComponent = observer(function WebGLPileupComponent({
  model,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<WebGLRenderer | null>(null)
  const canvasId = useId()

  // Use ResizeObserver via useMeasure for passive dimension tracking
  // This avoids forced layout from reading clientWidth/clientHeight
  const [measureRef, measuredDims] = useMeasure()

  // Y-axis scroll state (not part of view)
  const rangeYRef = useRef<[number, number]>([0, 600])

  // Feature highlighting - use ref to avoid re-renders on mouse move
  const highlightedFeatureIndexRef = useRef<number>(-1)
  // Selected feature for outline
  const selectedFeatureIndexRef = useRef<number>(-1)
  // Track if over a CIGAR item for cursor
  const [overCigarItem, setOverCigarItem] = useState(false)
  // Track hover state for resize handle
  const [resizeHandleHovered, setResizeHandleHovered] = useState(false)

  const [maxY, setMaxY] = useState(0)
  const [rendererReady, setRendererReady] = useState(false)

  // Rendering and data loading
  const renderRAFRef = useRef<number | null>(null)
  const scheduleRenderRef = useRef<() => void>(() => {})
  const pendingDataRequestRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )
  const lastRequestedRegionRef = useRef<{ start: number; end: number } | null>(
    null,
  )

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

  // Cache canvas bounding rect to avoid forced layout on every wheel event
  const canvasRectRef = useRef<DOMRect | null>(null)

  const view = getContainingView(model) as LinearGenomeViewModel | undefined
  const viewId = view?.id

  // Get theme for dynamic colors
  const theme = useTheme()

  // Build color palette from theme (memoized to avoid unnecessary recalculations)
  const colorPalette = useMemo(() => buildColorPaletteFromTheme(theme), [theme])

  const contrastMap = useMemo(() => getContrastBaseMap(theme), [theme])

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

    const dynamicBlocks = (
      view as unknown as {
        dynamicBlocks?: {
          contentBlocks?: {
            refName: string
            start: number
            end: number
            offsetPx?: number
          }[]
        }
      }
    ).dynamicBlocks
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
      const w = canvasW ?? width
      if (!rendererRef.current || w === undefined) {
        return
      }

      rendererRef.current.render({
        domainX,
        rangeY: rangeYRef.current,
        colorScheme: colorSchemeIndex,
        featureHeight,
        featureSpacing,
        showCoverage,
        coverageHeight,
        coverageYOffset: YSCALEBAR_LABEL_OFFSET,
        showMismatches,
        showInterbaseCounts,
        showInterbaseIndicators,
        canvasWidth: w,
        canvasHeight: height,
        highlightedFeatureIndex: highlightedFeatureIndexRef.current,
        selectedFeatureIndex: selectedFeatureIndexRef.current,
        colors: colorPalette,
      })
    },
    [
      colorSchemeIndex,
      colorPalette,
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
    const visibleBpRange = getVisibleBpRange()
    if (!visibleBpRange) {
      return
    }
    renderWithDomain(visibleBpRange)
  }, [getVisibleBpRange, renderWithDomain])

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

    const dispose = autorun(() => {
      // Track view observables - autorun re-runs when these change
      const _offsetPx = view.offsetPx
      const _bpPerPx = view.bpPerPx
      if (!view.initialized) {
        return
      }

      // Sync domain to model for data-loading reaction
      const visibleBpRange = getVisibleBpRangeRef.current()
      if (visibleBpRange) {
        model.setCurrentDomain(visibleBpRange)
      }

      renderNowRef.current()
    })

    return () => {
      dispose()
    }
  }, [view, model])

  // Upload all data to GPU from RPC typed arrays atomically
  // Read data, CIGAR data, and coverage/SNP data must be uploaded together
  // to prevent race conditions during rapid scrolling where coverage
  // rectangles could be rendered with stale SNP data (or vice versa)
  useEffect(() => {
    if (!rendererRef.current || !rpcData || rpcData.numReads === 0) {
      return
    }

    const renderer = rendererRef.current

    // Upload read data
    renderer.uploadFromTypedArrays({
      regionStart: rpcData.regionStart,
      readPositions: rpcData.readPositions,
      readYs: rpcData.readYs,
      readFlags: rpcData.readFlags,
      readMapqs: rpcData.readMapqs,
      readInsertSizes: rpcData.readInsertSizes,
      readPairOrientations: rpcData.readPairOrientations,
      readStrands: rpcData.readStrands,
      numReads: rpcData.numReads,
      maxY: rpcData.maxY,
    })
    setMaxY(rpcData.maxY)
    model.setMaxY(rpcData.maxY)

    // Upload CIGAR data
    renderer.uploadCigarFromTypedArrays({
      gapPositions: rpcData.gapPositions,
      gapYs: rpcData.gapYs,
      gapTypes: rpcData.gapTypes,
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

    // Upload coverage/SNP data in the same effect
    if (showCoverage) {
      renderer.uploadCoverageFromTypedArrays({
        coverageDepths: rpcData.coverageDepths,
        coverageMaxDepth: rpcData.coverageMaxDepth,
        coverageBinSize: rpcData.coverageBinSize,
        coverageStartOffset: rpcData.coverageStartOffset,
        numCoverageBins: rpcData.numCoverageBins,
        snpPositions: rpcData.snpPositions,
        snpYOffsets: rpcData.snpYOffsets,
        snpHeights: rpcData.snpHeights,
        snpColorTypes: rpcData.snpColorTypes,
        numSnpSegments: rpcData.numSnpSegments,
        noncovPositions: rpcData.noncovPositions,
        noncovYOffsets: rpcData.noncovYOffsets,
        noncovHeights: rpcData.noncovHeights,
        noncovColorTypes: rpcData.noncovColorTypes,
        noncovMaxCount: rpcData.noncovMaxCount,
        numNoncovSegments: rpcData.numNoncovSegments,
        indicatorPositions: rpcData.indicatorPositions,
        indicatorColorTypes: rpcData.indicatorColorTypes,
        numIndicators: rpcData.numIndicators,
      })
    }

    scheduleRenderRef.current()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rpcData, showCoverage])

  // Re-render on settings change
  useEffect(() => {
    if (rendererReady) {
      scheduleRenderRef.current()
    }
  }, [
    rendererReady,
    colorSchemeIndex,
    colorPalette,
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
        checkDataNeedsRef.current()
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
        renderNowRef.current()
      } else if (view.scrollZoom || e.ctrlKey || e.metaKey) {
        e.preventDefault()
        e.stopPropagation()
        // Zoom around mouse position
        const currentRange = getVisibleBpRangeRef.current()
        if (!currentRange) {
          return
        }

        // Use cached rect to avoid forced layout on every wheel event
        // Lazy init on first interaction if RAF hasn't fired yet
        let rect = canvasRectRef.current
        if (!rect) {
          rect = canvas.getBoundingClientRect()
          canvasRectRef.current = rect
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
          return
        }

        // Position new range so mouseBp stays at same screen position
        const newRangeStart = mouseBp - mouseFraction * newRangeWidth

        // Compute new offsetPx from the new range start
        const contentBlocks = (
          view as unknown as {
            dynamicBlocks?: {
              contentBlocks?: {
                refName: string
                start: number
                end: number
                offsetPx?: number
              }[]
            }
          }
        ).dynamicBlocks?.contentBlocks as
          | { refName: string; start: number; end: number; offsetPx?: number }[]
          | undefined
        const first = contentBlocks?.[0]
        if (first) {
          const blockOffsetPx = first.offsetPx ?? 0
          const assemblyOrigin = first.start - blockOffsetPx * view.bpPerPx
          const newOffsetPx = (newRangeStart - assemblyOrigin) / newBpPerPx
          view.setNewView(newBpPerPx, newOffsetPx)
        }

        checkDataNeedsRef.current()
      }
    }

    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
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

    // Horizontal pan - update view state, autorun handles rendering
    if (dx !== 0) {
      const newOffsetPx = clampOffsetRef.current(view.offsetPx - dx)
      view.setNewView(view.bpPerPx, newOffsetPx)
      checkDataNeedsRef.current()
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
    // Clear highlight and re-render
    if (highlightedFeatureIndexRef.current !== -1) {
      highlightedFeatureIndexRef.current = -1
      renderNowRef.current()
    }
  }, [model])

  // Hit test to find feature at given canvas coordinates
  // Returns { id, index } or undefined
  const hitTestFeature = useCallback(
    (
      canvasX: number,
      canvasY: number,
    ): { id: string; index: number } | undefined => {
      const view = viewRef.current
      const w = widthRef.current
      if (!view?.initialized || w === undefined || !rpcData) {
        return undefined
      }

      const visibleBpRange = getVisibleBpRangeRef.current()
      if (!visibleBpRange) {
        return undefined
      }

      // Convert canvas X to genomic coordinate
      const bpPerPx = (visibleBpRange[1] - visibleBpRange[0]) / w
      const genomicPos = visibleBpRange[0] + canvasX * bpPerPx

      // Convert genomic position to offset from regionStart
      const posOffset = genomicPos - rpcData.regionStart

      // Convert canvas Y to row number (accounting for Y scroll)
      const rowHeight = featureHeight + featureSpacing
      const scrolledY = canvasY + rangeYRef.current[0]
      // Adjust for coverage height if shown
      const adjustedY = showCoverage ? scrolledY - coverageHeight : scrolledY
      if (adjustedY < 0) {
        return undefined
      }
      const row = Math.floor(adjustedY / rowHeight)

      // Also check if we're within the feature height (not in spacing)
      const yWithinRow = adjustedY - row * rowHeight
      if (yWithinRow > featureHeight) {
        return undefined
      }

      // Search through reads to find one at this position
      // Only check reads that are in the target row for efficiency
      const { readPositions, readYs, readIds, numReads } = rpcData
      if (!readIds) {
        return undefined
      }
      for (let i = 0; i < numReads; i++) {
        const y = readYs[i]
        if (y !== row) {
          continue
        }

        const startOffset = readPositions[i * 2]
        const endOffset = readPositions[i * 2 + 1]
        if (
          startOffset !== undefined &&
          endOffset !== undefined &&
          posOffset >= startOffset &&
          posOffset <= endOffset
        ) {
          return { id: readIds[i]!, index: i }
        }
      }

      return undefined
    },
    [rpcData, featureHeight, featureSpacing, showCoverage, coverageHeight],
  )

  // Hit test for CIGAR items (mismatches, insertions, gaps, clips)
  const hitTestCigarItem = useCallback(
    (canvasX: number, canvasY: number): CigarHitResult | undefined => {
      const view = viewRef.current
      const w = widthRef.current
      if (!view?.initialized || w === undefined || !rpcData) {
        return undefined
      }

      const visibleBpRange = getVisibleBpRangeRef.current()
      if (!visibleBpRange) {
        return undefined
      }

      // Convert canvas X to genomic coordinate
      const bpPerPx = (visibleBpRange[1] - visibleBpRange[0]) / w
      const genomicPos = visibleBpRange[0] + canvasX * bpPerPx

      // Convert genomic position to offset from regionStart
      const posOffset = genomicPos - rpcData.regionStart

      // Convert canvas Y to row number (accounting for Y scroll)
      const rowHeight = featureHeight + featureSpacing
      const scrolledY = canvasY + rangeYRef.current[0]
      // Adjust for coverage height if shown
      const adjustedY = showCoverage ? scrolledY - coverageHeight : scrolledY
      if (adjustedY < 0) {
        return undefined
      }
      const row = Math.floor(adjustedY / rowHeight)

      // Check if within feature height
      const yWithinRow = adjustedY - row * rowHeight
      if (yWithinRow > featureHeight) {
        return undefined
      }

      // Hit tolerance for interbase features (insertions, hardclips)
      const hitToleranceBp = Math.max(0.5, bpPerPx * 3)

      // Check mismatches first (1bp features covering [pos, pos+1))
      const {
        mismatchPositions,
        mismatchYs,
        mismatchBases,
        numMismatches,
        insertionPositions,
        insertionYs,
        insertionLengths,
        insertionSequences,
        numInsertions,
        gapPositions,
        gapYs,
        numGaps,
        softclipPositions,
        softclipYs,
        softclipLengths,
        numSoftclips,
        hardclipPositions,
        hardclipYs,
        hardclipLengths,
        numHardclips,
        regionStart,
      } = rpcData

      // Check mismatches first (they're visually prominent)
      // Mismatches are 1bp features - use floor to determine which base mouse is over
      const mouseBaseOffset = Math.floor(posOffset)
      for (let i = 0; i < numMismatches; i++) {
        const y = mismatchYs[i]
        if (y !== row) {
          continue
        }
        const pos = mismatchPositions[i]
        if (pos !== undefined && mouseBaseOffset === pos) {
          const baseCode = mismatchBases[i]!
          return {
            type: 'mismatch',
            index: i,
            position: regionStart + pos,
            base: String.fromCharCode(baseCode),
          }
        }
      }

      // Check insertions (rendered as markers at interbase positions)
      // Large insertions (>=10bp) are rendered as wider rectangles when zoomed in
      for (let i = 0; i < numInsertions; i++) {
        const y = insertionYs[i]
        if (y !== row) {
          continue
        }
        const pos = insertionPositions[i]
        if (pos !== undefined) {
          const len = insertionLengths[i] ?? 0
          const pxPerBp = 1 / bpPerPx
          // Get visual width from helper, add 2px buffer for easier clicking
          const rectWidthPx = getInsertionRectWidthPx(len, pxPerBp) + 4
          const rectHalfWidthBp = (rectWidthPx / 2) * bpPerPx
          if (Math.abs(posOffset - pos) < rectHalfWidthBp) {
            return {
              type: 'insertion',
              index: i,
              position: regionStart + pos,
              length: len,
              sequence: insertionSequences?.[i] || undefined,
            }
          }
        }
      }

      // Check gaps (deletions/skips - have start and end)
      const { gapTypes } = rpcData
      for (let i = 0; i < numGaps; i++) {
        const y = gapYs[i]
        if (y !== row) {
          continue
        }
        const startPos = gapPositions[i * 2]
        const endPos = gapPositions[i * 2 + 1]
        if (
          startPos !== undefined &&
          endPos !== undefined &&
          posOffset >= startPos &&
          posOffset <= endPos
        ) {
          // gapTypes: 0 = deletion, 1 = skip
          const gapType = gapTypes?.[i]
          return {
            type: gapType === 1 ? 'skip' : 'deletion',
            index: i,
            position: regionStart + startPos,
            length: endPos - startPos,
          }
        }
      }

      // Check softclips
      for (let i = 0; i < numSoftclips; i++) {
        const y = softclipYs[i]
        if (y !== row) {
          continue
        }
        const pos = softclipPositions[i]
        const len = softclipLengths[i]
        // Softclips are rendered as blocks starting at their position
        if (
          pos !== undefined &&
          len !== undefined &&
          posOffset >= pos &&
          posOffset <= pos + len
        ) {
          return {
            type: 'softclip',
            index: i,
            position: regionStart + pos,
            length: len,
          }
        }
      }

      // Check hardclips
      for (let i = 0; i < numHardclips; i++) {
        const y = hardclipYs[i]
        if (y !== row) {
          continue
        }
        const pos = hardclipPositions[i]
        const len = hardclipLengths[i]
        // Hardclips are rendered as markers at their position
        if (pos !== undefined && Math.abs(posOffset - pos) < hitToleranceBp) {
          return {
            type: 'hardclip',
            index: i,
            position: regionStart + pos,
            length: len,
          }
        }
      }

      return undefined
    },
    [rpcData, featureHeight, featureSpacing, showCoverage, coverageHeight],
  )

  // Hit test for coverage area (grey bars + SNP segments)
  const hitTestCoverage = useCallback(
    (canvasX: number, canvasY: number): CoverageHitResult | undefined => {
      const view = viewRef.current
      const w = widthRef.current
      if (
        !view?.initialized ||
        w === undefined ||
        !rpcData ||
        !showCoverage ||
        canvasY > coverageHeight
      ) {
        return undefined
      }

      const visibleBpRange = getVisibleBpRangeRef.current()
      if (!visibleBpRange) {
        return undefined
      }

      // Convert canvas X to genomic coordinate
      const bpPerPx = (visibleBpRange[1] - visibleBpRange[0]) / w
      const genomicPos = visibleBpRange[0] + canvasX * bpPerPx

      // Convert genomic position to offset from regionStart
      const posOffset = genomicPos - rpcData.regionStart

      // Find coverage bin for this position
      const { coverageDepths, coverageBinSize, coverageMaxDepth, regionStart } =
        rpcData
      const binIndex = Math.floor(posOffset / coverageBinSize)
      if (binIndex < 0 || binIndex >= coverageDepths.length) {
        return undefined
      }

      const depth = coverageDepths[binIndex]
      if (depth === undefined || depth === 0) {
        return undefined
      }

      // Collect SNPs at this position
      const snps: { base: string; count: number }[] = []
      const baseNames = ['A', 'C', 'G', 'T']
      const snpCounts: Record<string, number> = { A: 0, C: 0, G: 0, T: 0 }

      // Look for SNP segments at this position
      const {
        snpPositions,
        snpHeights,
        snpColorTypes,
        numSnpSegments,
        noncovPositions,
        noncovHeights,
        noncovColorTypes,
        numNoncovSegments,
      } = rpcData

      // Integer position for exact matching
      const intPosOffset = Math.floor(posOffset)

      for (let i = 0; i < numSnpSegments; i++) {
        const snpPos = snpPositions[i]
        if (snpPos === intPosOffset) {
          const colorType = snpColorTypes[i]
          const height = snpHeights[i]
          if (
            colorType !== undefined &&
            height !== undefined &&
            colorType >= 1 &&
            colorType <= 4
          ) {
            const baseName = baseNames[colorType - 1]!
            // Convert normalized height back to count
            const count = Math.round(height * coverageMaxDepth)
            snpCounts[baseName]! += count
          }
        }
      }

      for (const [base, count] of Object.entries(snpCounts)) {
        if (count > 0) {
          snps.push({ base, count })
        }
      }

      // Also collect noncov (interbase) data at this position
      const noncovCounts: Record<string, number> = {
        insertion: 0,
        softclip: 0,
        hardclip: 0,
      }
      const noncovNames = ['insertion', 'softclip', 'hardclip']

      for (let i = 0; i < numNoncovSegments; i++) {
        const noncovPos = noncovPositions[i]
        if (noncovPos === intPosOffset) {
          const colorType = noncovColorTypes[i]
          const height = noncovHeights[i]
          if (
            colorType !== undefined &&
            height !== undefined &&
            colorType >= 1 &&
            colorType <= 3
          ) {
            const typeName = noncovNames[colorType - 1]!
            // Convert normalized height back to count using noncovMaxCount
            const count = Math.round(height * rpcData.noncovMaxCount)
            noncovCounts[typeName]! += count
          }
        }
      }

      // Add noncov items to snps array with different formatting
      for (const [type, count] of Object.entries(noncovCounts)) {
        if (count > 0) {
          snps.push({ base: type, count })
        }
      }

      return {
        type: 'coverage',
        position: regionStart + binIndex * coverageBinSize,
        depth,
        snps,
      }
    },
    [rpcData, showCoverage, coverageHeight],
  )

  // Hit test for interbase indicators (triangles at top)
  const hitTestIndicator = useCallback(
    (canvasX: number, canvasY: number): IndicatorHitResult | undefined => {
      const view = viewRef.current
      const w = widthRef.current
      // Indicators are at the very top (within first ~5px)
      // Only hit test if indicators are being shown
      if (
        !view?.initialized ||
        w === undefined ||
        !rpcData ||
        !showCoverage ||
        !showInterbaseIndicators ||
        canvasY > 5
      ) {
        return undefined
      }

      const visibleBpRange = getVisibleBpRangeRef.current()
      if (!visibleBpRange) {
        return undefined
      }

      // Convert canvas X to genomic coordinate
      const bpPerPx = (visibleBpRange[1] - visibleBpRange[0]) / w
      const genomicPos = visibleBpRange[0] + canvasX * bpPerPx

      // Convert genomic position to offset from regionStart
      const posOffset = genomicPos - rpcData.regionStart

      // Hit tolerance for indicators (7px triangle width)
      const hitToleranceBp = Math.max(1, bpPerPx * 5)

      const {
        indicatorPositions,
        indicatorColorTypes,
        numIndicators,
        noncovPositions,
        noncovHeights,
        noncovColorTypes,
        numNoncovSegments,
        regionStart,
      } = rpcData

      for (let i = 0; i < numIndicators; i++) {
        const pos = indicatorPositions[i]
        if (pos !== undefined && Math.abs(posOffset - pos) < hitToleranceBp) {
          const colorType = indicatorColorTypes[i]
          const types = ['insertion', 'softclip', 'hardclip'] as const
          const indicatorType = types[(colorType ?? 1) - 1] ?? 'insertion'

          // Collect counts for all interbase types at this position
          const counts = { insertion: 0, softclip: 0, hardclip: 0 }
          const noncovNames = ['insertion', 'softclip', 'hardclip'] as const

          for (let j = 0; j < numNoncovSegments; j++) {
            const noncovPos = noncovPositions[j]
            if (noncovPos === pos) {
              const noncovColorType = noncovColorTypes[j]
              const height = noncovHeights[j]
              if (
                noncovColorType !== undefined &&
                height !== undefined &&
                noncovColorType >= 1 &&
                noncovColorType <= 3
              ) {
                const typeName = noncovNames[noncovColorType - 1]!
                const count = Math.round(height * rpcData.noncovMaxCount)
                counts[typeName] += count
              }
            }
          }

          return {
            type: 'indicator',
            position: regionStart + pos,
            indicatorType,
            counts,
          }
        }
      }

      return undefined
    },
    [rpcData, showCoverage, showInterbaseIndicators],
  )

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // If dragging, handle pan instead of hover
      if (dragRef.current.isDragging) {
        handleMouseMove(e)
        return
      }

      const canvas = canvasRef.current
      if (!canvas) {
        return
      }

      let rect = canvasRectRef.current
      if (!rect) {
        rect = canvas.getBoundingClientRect()
        canvasRectRef.current = rect
      }

      const canvasX = e.clientX - rect.left
      const canvasY = e.clientY - rect.top

      // Check for indicator hits first (triangles at top of coverage)
      const indicatorHit = hitTestIndicator(canvasX, canvasY)
      if (indicatorHit) {
        setOverCigarItem(true)
        model.setFeatureIdUnderMouse(undefined)

        // Look up detailed tooltip data from rpcData
        const posOffset = indicatorHit.position - (rpcData?.regionStart ?? 0)
        const tooltipBin = rpcData?.tooltipData?.[posOffset]
        const refName = model.loadedRegion?.refName

        if (tooltipBin) {
          // Use structured tooltip data
          const tooltipData = JSON.stringify({
            type: 'indicator',
            indicatorType: indicatorHit.indicatorType,
            bin: tooltipBin,
            refName,
          })
          model.setMouseoverExtraInformation(tooltipData)
        } else {
          // Fallback to simple tooltip
          const pos = indicatorHit.position.toLocaleString()
          const { counts } = indicatorHit
          const total = counts.insertion + counts.softclip + counts.hardclip
          const parts: string[] = []
          if (counts.insertion > 0) {
            parts.push(`Insertions: ${counts.insertion}`)
          }
          if (counts.softclip > 0) {
            parts.push(`Soft clips: ${counts.softclip}`)
          }
          if (counts.hardclip > 0) {
            parts.push(`Hard clips: ${counts.hardclip}`)
          }
          const tooltipText = `<b>Interbase events at ${pos}</b><br>Total: ${total}<br>${parts.join('<br>')}`
          model.setMouseoverExtraInformation(tooltipText)
        }

        // Clear highlight
        if (highlightedFeatureIndexRef.current !== -1) {
          highlightedFeatureIndexRef.current = -1
          renderNowRef.current()
        }
        return
      }

      // Check for coverage area hits (grey bars + SNP segments)
      const coverageHit = hitTestCoverage(canvasX, canvasY)
      if (coverageHit) {
        setOverCigarItem(true)
        model.setFeatureIdUnderMouse(undefined)

        // Look up detailed tooltip data from rpcData
        const posOffset = coverageHit.position - (rpcData?.regionStart ?? 0)
        // For coverage, check nearby positions in tooltipData (within 1bp)
        let tooltipBin = rpcData?.tooltipData?.[posOffset]
        if (!tooltipBin) {
          // Check adjacent positions
          tooltipBin =
            rpcData?.tooltipData?.[posOffset - 1] ||
            rpcData?.tooltipData?.[posOffset + 1]
        }
        const refName = model.loadedRegion?.refName

        if (tooltipBin || coverageHit.depth > 0) {
          // Build tooltip bin data - use detailed data if available, otherwise use basic coverage info
          const bin = tooltipBin ?? {
            position: coverageHit.position,
            depth: coverageHit.depth,
            snps: {},
            delskips: {},
            interbase: {},
          }
          // If no tooltipBin but we have basic SNP data from hit test, include it
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

        // Clear highlight
        if (highlightedFeatureIndexRef.current !== -1) {
          highlightedFeatureIndexRef.current = -1
          renderNowRef.current()
        }
        return
      }

      // Check for CIGAR items (they're drawn on top of reads)
      const cigarHit = hitTestCigarItem(canvasX, canvasY)
      if (cigarHit) {
        setOverCigarItem(true)

        // Format CIGAR item tooltip
        const pos = cigarHit.position.toLocaleString()
        let tooltipText: string
        switch (cigarHit.type) {
          case 'mismatch':
            tooltipText = `SNP: ${cigarHit.base} at ${pos}`
            break
          case 'insertion':
            // Only show sequence in tooltip if it's short (<=20bp)
            tooltipText =
              cigarHit.sequence && cigarHit.sequence.length <= 20
                ? `Insertion (${cigarHit.length}bp): ${cigarHit.sequence} at ${pos}`
                : `Insertion (${cigarHit.length}bp) at ${pos}`
            break
          case 'deletion':
            tooltipText = `Deletion (${cigarHit.length}bp) at ${pos}`
            break
          case 'skip':
            tooltipText = `Skip/Intron (${cigarHit.length}bp) at ${pos}`
            break
          case 'softclip':
            tooltipText = `Soft clip (${cigarHit.length}bp) at ${pos}`
            break
          case 'hardclip':
            tooltipText = `Hard clip (${cigarHit.length}bp) at ${pos}`
            break
        }
        model.setMouseoverExtraInformation(tooltipText)

        // Still do feature hit test to keep highlight on underlying read
        const hit = hitTestFeature(canvasX, canvasY)
        const featureId = hit?.id
        const featureIndex = hit?.index ?? -1
        model.setFeatureIdUnderMouse(featureId)
        if (highlightedFeatureIndexRef.current !== featureIndex) {
          highlightedFeatureIndexRef.current = featureIndex
          renderNowRef.current()
        }
        return
      }

      // Not over a CIGAR item or coverage
      setOverCigarItem(false)

      // Fall back to feature hit testing
      const hit = hitTestFeature(canvasX, canvasY)
      const featureId = hit?.id
      const featureIndex = hit?.index ?? -1

      model.setFeatureIdUnderMouse(featureId)

      // Update highlight and re-render if changed
      if (highlightedFeatureIndexRef.current !== featureIndex) {
        highlightedFeatureIndexRef.current = featureIndex
        renderNowRef.current()
      }

      // Set tooltip info
      if (featureId) {
        const info = model.getFeatureInfoById(featureId)
        if (info) {
          const tooltipText = `${info.id} ${info.refName}:${info.start.toLocaleString()}-${info.end.toLocaleString()} (${info.strand})`
          model.setMouseoverExtraInformation(tooltipText)
        } else {
          model.setMouseoverExtraInformation(undefined)
        }
      } else {
        model.setMouseoverExtraInformation(undefined)
      }
    },
    [
      hitTestFeature,
      hitTestCigarItem,
      hitTestCoverage,
      hitTestIndicator,
      model,
      handleMouseMove,
    ],
  )

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current
      if (!canvas) {
        return
      }

      let rect = canvasRectRef.current
      if (!rect) {
        rect = canvas.getBoundingClientRect()
        canvasRectRef.current = rect
      }

      const canvasX = e.clientX - rect.left
      const canvasY = e.clientY - rect.top

      // Check for CIGAR item clicks first (they're on top)
      const cigarHit = hitTestCigarItem(canvasX, canvasY)
      if (cigarHit) {
        // Also get the feature hit to find the read ID
        const featureHit = hitTestFeature(canvasX, canvasY)
        const refName = model.loadedRegion?.refName ?? ''

        // Set selected feature for outline
        if (featureHit) {
          selectedFeatureIndexRef.current = featureHit.index
          renderNowRef.current()
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
            featureData.description = `${cigarHit.base} at ${refName}:${cigarHit.position.toLocaleString()}`
          } else if (cigarHit.type === 'insertion') {
            featureData.length = cigarHit.length
            if (cigarHit.sequence) {
              featureData.sequence = cigarHit.sequence
              featureData.description = `${cigarHit.length}bp insertion: ${cigarHit.sequence}`
            } else {
              featureData.description = `${cigarHit.length}bp insertion`
            }
          } else if (cigarHit.type === 'deletion') {
            featureData.length = cigarHit.length
            featureData.description = `${cigarHit.length}bp deletion`
          } else if (cigarHit.type === 'skip') {
            featureData.length = cigarHit.length
            featureData.description = `${cigarHit.length}bp skip (intron)`
          } else if (cigarHit.type === 'softclip') {
            featureData.length = cigarHit.length
            featureData.description = `${cigarHit.length}bp soft clip`
          } else if (cigarHit.type === 'hardclip') {
            featureData.length = cigarHit.length
            featureData.description = `${cigarHit.length}bp hard clip`
          }

          // Include read ID if available
          if (featureHit?.id) {
            featureData.readId = featureHit.id
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

      const hit = hitTestFeature(canvasX, canvasY)
      if (hit) {
        // Set selected feature for outline
        selectedFeatureIndexRef.current = hit.index
        renderNowRef.current()
        model.selectFeatureById(hit.id)
      } else {
        // Clear selection if clicking on empty space
        if (selectedFeatureIndexRef.current !== -1) {
          selectedFeatureIndexRef.current = -1
          renderNowRef.current()
        }
      }
    },
    [hitTestFeature, hitTestCigarItem, model],
  )

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current
      if (!canvas) {
        return
      }

      let rect = canvasRectRef.current
      if (!rect) {
        rect = canvas.getBoundingClientRect()
        canvasRectRef.current = rect
      }

      const canvasX = e.clientX - rect.left
      const canvasY = e.clientY - rect.top

      const hit = hitTestFeature(canvasX, canvasY)
      if (hit) {
        e.preventDefault()
        // For now, open feature widget on right-click (same as left-click)
        // TODO: implement proper context menu
        model.selectFeatureById(hit.id)
      }
    },
    [hitTestFeature, model],
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
    const rowHeight = featureHeight + featureSpacing
    const rangeY = rangeYRef.current
    const pileupYOffset = showCoverage ? coverageHeight : 0

    // Minimum pixel width needed to show a label (about 15px for short numbers like "5")
    const minLabelWidth = 15

    // Process deletions (gaps)
    const { gapPositions, gapYs, gapLengths, gapTypes, numGaps, regionStart } =
      rpcData
    if (gapPositions && gapYs && gapLengths && gapTypes) {
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
          y * rowHeight + featureHeight / 2 - rangeY[0] + pileupYOffset

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
    }

    // Process insertions
    const { insertionPositions, insertionYs, insertionLengths, numInsertions } =
      rpcData
    if (insertionPositions && insertionYs && insertionLengths) {
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
          y * rowHeight + featureHeight / 2 - rangeY[0] + pileupYOffset

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
    }

    // Process soft clips
    const { softclipPositions, softclipYs, softclipLengths, numSoftclips } =
      rpcData
    if (softclipPositions && softclipYs && softclipLengths && canRenderText) {
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
          y * rowHeight + featureHeight / 2 - rangeY[0] + pileupYOffset

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
    if (hardclipPositions && hardclipYs && hardclipLengths && canRenderText) {
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
          y * rowHeight + featureHeight / 2 - rangeY[0] + pileupYOffset

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
    if (mismatchPositions && mismatchYs && mismatchBases && canRenderText) {
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
          y * rowHeight + featureHeight / 2 - rangeY[0] + pileupYOffset

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
    featureHeight,
    featureSpacing,
    showMismatches,
    showCoverage,
    coverageHeight,
  ])

  if (error) {
    return (
      <div style={{ color: '#c00', padding: 16 }}>Error: {error.message}</div>
    )
  }

  const isReady = width !== undefined && labelBpRange !== null

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
            top: coverageHeight - 3,
            left: 0,
            right: 0,
            height: 6,
            cursor: 'row-resize',
            background: 'transparent',
            zIndex: 10,
          }}
          title="Drag to resize coverage track"
        >
          <div
            style={{
              position: 'absolute',
              top: 2,
              left: 0,
              right: 0,
              height: 2,
              background: theme.palette.divider,
              opacity: resizeHandleHovered ? 0.5 : 0,
              transition: 'opacity 0.15s ease',
            }}
          />
        </div>
      ) : null}

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
