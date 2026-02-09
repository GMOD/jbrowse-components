import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

import LoadingEllipses from '@jbrowse/core/ui/LoadingEllipses'
import {
  getContainingTrack,
  getContainingView,
  getSession,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import { colord } from '@jbrowse/core/util/colord'
import useMeasure from '@jbrowse/core/util/useMeasure'
import { TooLargeMessage } from '@jbrowse/plugin-linear-genome-view'
import { useTheme } from '@mui/material'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import { fillColor } from '../../shared/color.ts'
import { getContrastBaseMap } from '../../shared/util.ts'
import {
  YSCALEBAR_LABEL_OFFSET,
  getInsertionRectWidthPx,
  getInsertionType,
} from '../model.ts'
import CoverageYScaleBar from './CoverageYScaleBar.tsx'
import { getCoordinator, removeCoordinator } from './ViewCoordinator.ts'
import { WebGLRenderer } from './WebGLRenderer.ts'

import type { CoverageTicks } from './CoverageYScaleBar.tsx'
import type { ColorPalette, RGBColor } from './WebGLRenderer.ts'
import type { WebGLArcsDataResult } from '../../RenderWebGLArcsDataRPC/types.ts'
import type { WebGLCloudDataResult } from '../../RenderWebGLCloudDataRPC/types.ts'
import type { WebGLPileupDataResult } from '../../RenderWebGLPileupDataRPC/types.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { Theme } from '@mui/material'

function parseColorToRGB(color: string): RGBColor {
  const { r, g, b } = colord(color).toRgb()
  return [r / 255, g / 255, b / 255]
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
    // Modification mode read colors
    colorModificationFwd: parseColorToRGB(palette.modificationFwd),
    colorModificationRev: parseColorToRGB(palette.modificationRev),
  }
}

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

interface VisibleRegionBlock {
  refName: string
  regionNumber: number
  start: number
  end: number
  assemblyName: string
  screenStartPx: number
  screenEndPx: number
}

interface ResolvedBlock {
  rpcData: WebGLPileupDataResult
  bpRange: [number, number]
  blockStartPx: number
  blockWidth: number
  refName: string
}

function canvasToGenomicCoords(
  canvasX: number,
  canvasY: number,
  resolved: ResolvedBlock,
  featureHeight: number,
  featureSpacing: number,
  showCoverage: boolean,
  coverageHeight: number,
  rangeY: [number, number],
) {
  const { bpRange, blockStartPx, blockWidth, rpcData } = resolved
  const bpPerPx = (bpRange[1] - bpRange[0]) / blockWidth
  const genomicPos = bpRange[0] + (canvasX - blockStartPx) * bpPerPx
  const posOffset = genomicPos - rpcData.regionStart
  const rowHeight = featureHeight + featureSpacing
  const scrolledY = canvasY + rangeY[0]
  const adjustedY = showCoverage ? scrolledY - coverageHeight : scrolledY
  const row = Math.floor(adjustedY / rowHeight)
  const yWithinRow = adjustedY - row * rowHeight
  return { bpPerPx, genomicPos, posOffset, row, adjustedY, yWithinRow }
}

function getCanvasCoords(
  e: React.MouseEvent,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  canvasRectRef: React.RefObject<{ rect: DOMRect; timestamp: number } | null>,
) {
  const canvas = canvasRef.current
  if (!canvas) {
    return undefined
  }

  const now = Date.now()
  let cached = canvasRectRef.current

  // Invalidate cache if older than 100ms (catches scroll events and repositioning)
  if (cached && now - cached.timestamp < 100) {
    return {
      canvasX: e.clientX - cached.rect.left,
      canvasY: e.clientY - cached.rect.top,
    }
  }

  // Get fresh rect and cache it with timestamp
  const rect = canvas.getBoundingClientRect()
  canvasRectRef.current = { rect, timestamp: now }
  return { canvasX: e.clientX - rect.left, canvasY: e.clientY - rect.top }
}

function formatCigarTooltip(cigarHit: CigarHitResult) {
  const pos = cigarHit.position.toLocaleString()
  switch (cigarHit.type) {
    case 'mismatch':
      return `SNP: ${cigarHit.base} at ${pos}`
    case 'insertion':
      return cigarHit.sequence && cigarHit.sequence.length <= 20
        ? `Insertion (${cigarHit.length}bp): ${cigarHit.sequence} at ${pos}`
        : `Insertion (${cigarHit.length}bp) at ${pos}`
    case 'deletion':
      return `Deletion (${cigarHit.length}bp) at ${pos}`
    case 'skip':
      return `Skip/Intron (${cigarHit.length}bp) at ${pos}`
    case 'softclip':
      return `Soft clip (${cigarHit.length}bp) at ${pos}`
    case 'hardclip':
      return `Hard clip (${cigarHit.length}bp) at ${pos}`
  }
}

function uploadRegionDataToGPU(
  renderer: WebGLRenderer,
  rpcDataMap: Map<number, WebGLPileupDataResult>,
  showCoverage: boolean,
) {
  renderer.clearLegacyBuffers()
  let maxYVal = 0
  for (const [regionNumber, data] of rpcDataMap) {
    if (data.numReads === 0) {
      continue
    }
    renderer.uploadFromTypedArraysForRegion(regionNumber, data)
    renderer.uploadCigarFromTypedArraysForRegion(regionNumber, data)
    renderer.uploadModificationsFromTypedArraysForRegion(regionNumber, data)
    if (data.maxY > maxYVal) {
      maxYVal = data.maxY
    }
    if (showCoverage) {
      renderer.uploadCoverageFromTypedArraysForRegion(regionNumber, data)
      renderer.uploadModCoverageFromTypedArraysForRegion(regionNumber, data)
      if (data.numSashimiArcs > 0) {
        renderer.uploadSashimiFromTypedArraysForRegion(regionNumber, data)
      }
    }
  }
  return maxYVal
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
  featureHeight: number
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
    visibleRegions,
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
    const disposeDomainSync = autorun(() => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { offsetPx: _op, bpPerPx: _bpp, initialized } = view
      if (!initialized) {
        return
      }

      const visibleBpRange = getVisibleBpRangeRef.current()
      if (visibleBpRange) {
        model.setCurrentBpRange(visibleBpRange)
      }
    })

    // Re-render when view or model visual state changes
    const disposeRender = autorun(() => {
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
    })

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
  const hitTestFeature = useCallback(
    (
      canvasX: number,
      canvasY: number,
    ): { id: string; index: number } | undefined => {
      if (widthRef.current === undefined) {
        return undefined
      }
      const resolved = resolveBlockForCanvasX(canvasX)
      if (!resolved) {
        return undefined
      }
      const { posOffset, row, adjustedY, yWithinRow } = canvasToGenomicCoords(
        canvasX,
        canvasY,
        resolved,
        featureHeightSetting,
        featureSpacing,
        showCoverage,
        coverageHeight,
        model.currentRangeY,
      )
      if (adjustedY < 0 || yWithinRow > featureHeightSetting) {
        return undefined
      }

      const { readPositions, readYs, readIds, numReads } = resolved.rpcData
      for (let i = 0; i < numReads; i++) {
        if (readYs[i] !== row) {
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
    [
      resolveBlockForCanvasX,
      featureHeightSetting,
      featureSpacing,
      showCoverage,
      coverageHeight,
      model,
    ],
  )

  // Hit test for CIGAR items (mismatches, insertions, gaps, clips)
  const hitTestCigarItem = useCallback(
    (canvasX: number, canvasY: number): CigarHitResult | undefined => {
      if (widthRef.current === undefined) {
        return undefined
      }
      const resolved = resolveBlockForCanvasX(canvasX)
      if (!resolved) {
        return undefined
      }
      const { bpPerPx, posOffset, row, adjustedY, yWithinRow } =
        canvasToGenomicCoords(
          canvasX,
          canvasY,
          resolved,
          featureHeightSetting,
          featureSpacing,
          showCoverage,
          coverageHeight,
          model.currentRangeY,
        )
      if (adjustedY < 0 || yWithinRow > featureHeightSetting) {
        return undefined
      }
      const blockData = resolved.rpcData

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
      } = blockData

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
              sequence: insertionSequences[i] || undefined,
            }
          }
        }
      }

      // Check gaps (deletions/skips - have start and end)
      const { gapTypes } = blockData
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
          const gapType = gapTypes[i]
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
    [
      resolveBlockForCanvasX,
      featureHeightSetting,
      featureSpacing,
      showCoverage,
      coverageHeight,
      model,
    ],
  )

  // Hit test for coverage area (grey bars + SNP segments)
  const hitTestCoverage = useCallback(
    (canvasX: number, canvasY: number): CoverageHitResult | undefined => {
      if (
        widthRef.current === undefined ||
        !showCoverage ||
        canvasY > coverageHeight
      ) {
        return undefined
      }
      const resolved = resolveBlockForCanvasX(canvasX)
      if (!resolved) {
        return undefined
      }
      const blockData = resolved.rpcData
      const { bpRange, blockStartPx, blockWidth } = resolved
      const bpPerPx = (bpRange[1] - bpRange[0]) / blockWidth
      const genomicPos = bpRange[0] + (canvasX - blockStartPx) * bpPerPx
      const posOffset = genomicPos - blockData.regionStart

      const {
        coverageDepths,
        coverageBinSize,
        coverageStartOffset,
        coverageMaxDepth,
        regionStart,
      } = blockData
      const binIndex = Math.floor(
        (posOffset - coverageStartOffset) / coverageBinSize,
      )
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
      } = blockData

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
            const count = Math.round(height * blockData.noncovMaxCount)
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
        position:
          regionStart + coverageStartOffset + binIndex * coverageBinSize,
        depth,
        snps,
      }
    },
    [resolveBlockForCanvasX, showCoverage, coverageHeight],
  )

  // Hit test for interbase indicators (triangles at top)
  const hitTestIndicator = useCallback(
    (canvasX: number, canvasY: number): IndicatorHitResult | undefined => {
      if (
        widthRef.current === undefined ||
        !showCoverage ||
        !showInterbaseIndicators ||
        canvasY > 5
      ) {
        return undefined
      }
      const resolved = resolveBlockForCanvasX(canvasX)
      if (!resolved) {
        return undefined
      }
      const blockData = resolved.rpcData
      const { bpRange, blockStartPx, blockWidth } = resolved
      const bpPerPx = (bpRange[1] - bpRange[0]) / blockWidth
      const posOffset =
        bpRange[0] + (canvasX - blockStartPx) * bpPerPx - blockData.regionStart

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
      } = blockData

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
                const count = Math.round(height * blockData.noncovMaxCount)
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
    [resolveBlockForCanvasX, showCoverage, showInterbaseIndicators],
  )

  const hitTestSashimiArc = useCallback(
    (
      canvasX: number,
      canvasY: number,
    ):
      | {
          start: number
          end: number
          score: number
          strand: number
          refName: string
        }
      | undefined => {
      if (
        widthRef.current === undefined ||
        !showCoverage ||
        !showSashimiArcs ||
        canvasY > coverageHeight
      ) {
        return undefined
      }
      const resolved = resolveBlockForCanvasX(canvasX)
      if (!resolved) {
        return undefined
      }
      const { rpcData, bpRange, blockStartPx, blockWidth, refName } = resolved
      const {
        sashimiX1,
        sashimiX2,
        sashimiCounts,
        sashimiColorTypes,
        numSashimiArcs,
        regionStart,
      } = rpcData
      if (numSashimiArcs === 0) {
        return undefined
      }

      // CPU-based Bezier curve picking (fast enough for hover)
      const pxPerBp = blockWidth / (bpRange[1] - bpRange[0])
      const bpStartOffset = bpRange[0] - regionStart

      for (let i = 0; i < numSashimiArcs; i++) {
        const x1 = sashimiX1[i]!
        const x2 = sashimiX2[i]!
        const destY = coverageHeight

        // Arc thickness from score: Math.log(count + 1)
        // Adaptive hit tolerance: easier to hover over thin arcs
        const lineWidth = rpcData.sashimiScores[i]!
        const hitTolerance = Math.max(10, lineWidth * 2.5 + 2)

        // CRITICAL: This Bezier curve formula MUST match the GPU version in:
        // shaders/arcShaders.ts:evalCurve (around line 180)
        // If either implementation changes, the other MUST be updated to match,
        // otherwise picking and rendering will be out of sync.
        // Sample the bezier curve for hit detection
        // Adaptive sampling based on arc width in bp
        const arcWidthBp = Math.abs(x2 - x1)
        const samplesPerBp = pxPerBp / 10 // Sample roughly every 10 pixels
        const steps = Math.max(16, Math.min(256, Math.ceil(arcWidthBp * samplesPerBp)))
        let hit = false
        let minDist = Infinity
        for (let s = 0; s <= steps; s++) {
          const t = s / steps
          const mt = 1 - t
          const mt2 = mt * mt
          const mt3 = mt2 * mt
          const t2 = t * t
          const t3 = t2 * t
          const xBp = mt3 * x1 + 3 * mt2 * t * x1 + 3 * mt * t2 * x2 + t3 * x2
          const yPx = 3 * mt2 * t * destY + 3 * mt * t2 * destY
          const screenX = blockStartPx + (xBp - bpStartOffset) * pxPerBp
          const screenY = coverageHeight - yPx
          const dx = canvasX - screenX
          const dy = canvasY - screenY
          const distSq = dx * dx + dy * dy
          if (distSq < minDist) {
            minDist = distSq
          }
          if (distSq < hitTolerance * hitTolerance) {
            hit = true
            break
          }
        }
        if (hit) {
          const colorType = sashimiColorTypes[i]!
          const count = sashimiCounts[i]!
          return {
            start: regionStart + x1,
            end: regionStart + x2,
            score: count,
            strand: colorType === 0 ? 1 : -1,
            refName,
          }
        }
      }
      return undefined
    },
    [resolveBlockForCanvasX, showCoverage, showSashimiArcs, coverageHeight],
  )

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
      const indicatorHit = hitTestIndicator(canvasX, canvasY)
      if (indicatorHit) {
        setOverCigarItem(true)
        model.setFeatureIdUnderMouse(undefined)

        // Look up detailed tooltip data from rpcData
        const posOffset =
          indicatorHit.position - (blockRpcData?.regionStart ?? 0)
        const tooltipBin = blockRpcData?.tooltipData[posOffset]
        const refName = blockInfo?.refName

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

        if (model.highlightedFeatureIndex !== -1) {
          model.setHighlightedFeatureIndex(-1)
        }
        return
      }

      // Check for sashimi arc hits (splice junction arcs overlaid on coverage)
      const sashimiHit = hitTestSashimiArc(canvasX, canvasY)
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
      const coverageHit = hitTestCoverage(canvasX, canvasY)
      if (coverageHit) {
        setOverCigarItem(true)
        model.setFeatureIdUnderMouse(undefined)

        // Look up detailed tooltip data from rpcData
        const posOffset =
          coverageHit.position - (blockRpcData?.regionStart ?? 0)
        // For coverage, check nearby positions in tooltipData (within 1bp)
        let tooltipBin = blockRpcData?.tooltipData[posOffset]
        if (!tooltipBin) {
          // Check adjacent positions
          tooltipBin =
            blockRpcData?.tooltipData[posOffset - 1] ||
            blockRpcData?.tooltipData[posOffset + 1]
        }
        const refName = blockInfo?.refName

        if (tooltipBin || coverageHit.depth > 0) {
          // Build tooltip bin data - use detailed data if available, otherwise use basic coverage info
          const bin = tooltipBin ?? {
            position: coverageHit.position,
            depth: coverageHit.depth,
            snps: {},
            interbase: {},
          }
          // Remove delskips from coverage tooltip - users see skip stats via sashimi arcs instead
          if (bin && 'delskips' in bin) {
            delete bin.delskips
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

        if (model.highlightedFeatureIndex !== -1) {
          model.setHighlightedFeatureIndex(-1)
        }
        return
      }

      // Check for CIGAR items (they're drawn on top of reads)
      const cigarHit = hitTestCigarItem(canvasX, canvasY)
      if (cigarHit) {
        setOverCigarItem(true)
        model.setMouseoverExtraInformation(formatCigarTooltip(cigarHit))

        // Still do feature hit test to keep highlight on underlying read
        const hit = hitTestFeature(canvasX, canvasY)
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
      const hit = hitTestFeature(canvasX, canvasY)
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
      hitTestFeature,
      hitTestCigarItem,
      hitTestCoverage,
      hitTestIndicator,
      hitTestSashimiArc,
      model,
      handleMouseMove,
      resolveBlockForCanvasX,
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
      const indicatorHit = hitTestIndicator(canvasX, canvasY)
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
      const coverageHit = hitTestCoverage(canvasX, canvasY)
      if (coverageHit) {
        const blockHit = resolveBlockForCanvasX(canvasX)
        const refName = blockHit?.refName ?? model.loadedRegion?.refName ?? ''
        const blockRpcData = blockHit?.rpcData
        const posOffset =
          coverageHit.position - (blockRpcData?.regionStart ?? 0)
        const tooltipBin =
          blockRpcData?.tooltipData[posOffset] ??
          blockRpcData?.tooltipData[posOffset - 1] ??
          blockRpcData?.tooltipData[posOffset + 1]

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
                featureData[`SNP ${base.toUpperCase()}`] =
                  `${entry.count}/${tooltipBin.depth} (${entry.fwd}(+) ${entry.rev}(-))`
              }
              for (const [type, entry] of Object.entries(
                tooltipBin.interbase,
              )) {
                featureData[type] =
                  `${entry.count} (${entry.minLen}-${entry.maxLen}bp)`
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
      const cigarHit = hitTestCigarItem(canvasX, canvasY)
      if (cigarHit) {
        // Also get the feature hit to find the read ID
        const featureHit = hitTestFeature(canvasX, canvasY)
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
        model.setSelectedFeatureIndex(hit.index)
        model.selectFeatureById(hit.id)
      } else {
        if (model.selectedFeatureIndex !== -1) {
          model.setSelectedFeatureIndex(-1)
        }
      }
    },
    [
      hitTestFeature,
      hitTestCigarItem,
      hitTestCoverage,
      hitTestIndicator,
      resolveBlockForCanvasX,
      model,
    ],
  )

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      const coords = getCanvasCoords(e, canvasRef, canvasRectRef)
      if (!coords) {
        return
      }
      const hit = hitTestFeature(coords.canvasX, coords.canvasY)
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
      const yPx = y * rowHeight + featureHeightSetting / 2 - rangeY[0] + pileupYOffset

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
      const yPx = y * rowHeight + featureHeightSetting / 2 - rangeY[0] + pileupYOffset

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

  if (error) {
    return (
      <div style={{ color: '#c00', padding: 16 }}>Error: {error.message}</div>
    )
  }

  if (model.regionTooLarge) {
    return (
      <div style={{ padding: 16 }}>
        <TooLargeMessage model={model} />
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

      {model.showLoading && (
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
          <LoadingEllipses message={statusMessage || 'Loading'} />
        </div>
      )}
    </div>
  )
})

export default WebGLAlignmentsComponent
