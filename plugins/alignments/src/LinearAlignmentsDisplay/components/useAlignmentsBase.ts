import { useEffect, useId, useMemo, useRef, useState } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import useMeasure from '@jbrowse/core/util/useMeasure'
import { useTheme } from '@mui/material'
import { autorun } from 'mobx'

import { getContrastBaseMap } from '../../shared/util.ts'
import { YSCALEBAR_LABEL_OFFSET } from '../model.ts'
import { getCoordinator, removeCoordinator } from './ViewCoordinator.ts'
import { WebGLRenderer } from './WebGLRenderer.ts'
import {
  buildColorPaletteFromTheme,
  formatCigarTooltip,
  formatCoverageTooltip,
  formatIndicatorTooltip,
  formatSashimiTooltip,
  getCanvasCoords,
  uploadRegionDataToGPU,
} from './alignmentComponentUtils.ts'
import { computeVisibleLabels } from './computeVisibleLabels.ts'
import { performHitTest } from './hitTestPipeline.ts'
import {
  openCigarWidget,
  openCoverageWidget,
  openIndicatorWidget,
} from './openFeatureWidget.ts'

import type { ResolvedBlock } from './hitTesting.ts'
import type { CloudTicks } from './CloudYScaleBar.tsx'
import type { CoverageTicks } from './CoverageYScaleBar.tsx'
import type { WebGLArcsDataResult } from '../../RenderWebGLArcsDataRPC/types.ts'
import type { WebGLPileupDataResult } from '../../RenderWebGLPileupDataRPC/types.ts'
import type {
  LegendItem,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

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

export interface LinearAlignmentsDisplayModel {
  height: number
  rpcData: WebGLPileupDataResult | null
  rpcDataMap: Map<number, WebGLPileupDataResult>
  loadedRegion: { refName: string; start: number; end: number } | null
  loadedRegions: Map<number, { refName: string; start: number; end: number }>
  visibleRegions: VisibleRegionBlock[]
  visibleBpRange: [number, number] | null
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
  cloudTicks?: CloudTicks
  showLegend: boolean | undefined
  legendItems: LegendItem[]
  currentRangeY: [number, number]
  highlightedFeatureIndex: number
  selectedFeatureIndex: number
  highlightedChainIndices: number[]
  selectedChainIndices: number[]
  chainIndexMap: Map<string, number[]>
  setMaxY: (y: number) => void
  setCurrentRangeY: (rangeY: [number, number]) => void
  setCoverageHeight: (height: number) => void
  setHighlightedFeatureIndex: (index: number) => void
  setSelectedFeatureIndex: (index: number) => void
  setHighlightedChainIndices: (indices: number[]) => void
  setSelectedChainIndices: (indices: number[]) => void
  clearHighlights: () => void
  setFeatureIdUnderMouse: (id: string | undefined) => void
  setMouseoverExtraInformation: (info: string | undefined) => void
  selectFeatureById: (featureId: string) => void
  getFeatureInfoById: (featureId: string) => FeatureInfo | undefined
  renderingMode: 'pileup' | 'arcs' | 'cloud' | 'linkedRead'
  arcsState: {
    rpcData: WebGLArcsDataResult | null
    rpcDataMap: Map<number, WebGLArcsDataResult>
    lineWidth: number
  }
}

export interface FeatureHit {
  id: string
  index: number
}

export function useAlignmentsBase(
  model: LinearAlignmentsDisplayModel,
  isChainMode: boolean,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<WebGLRenderer | null>(null)
  const canvasId = useId()
  const [measureRef, measuredDims] = useMeasure()

  const [overCigarItem, setOverCigarItem] = useState(false)
  const [resizeHandleHovered, setResizeHandleHovered] = useState(false)

  const canvasRectRef = useRef<{ rect: DOMRect; timestamp: number } | null>(
    null,
  )
  const dragRef = useRef({ isDragging: false, lastX: 0 })
  const resizeDragRef = useRef({
    isDragging: false,
    startY: 0,
    startHeight: 0,
  })

  const view = getContainingView(model) as LinearGenomeViewModel
  const theme = useTheme()
  const colorPalette = useMemo(() => buildColorPaletteFromTheme(theme), [theme])
  const contrastMap = useMemo(() => getContrastBaseMap(theme), [theme])

  const {
    rpcData,
    rpcDataMap,
    statusMessage,
    featureHeightSetting,
    featureSpacing,
    showCoverage,
    coverageHeight,
    showMismatches,
    showInterbaseIndicators,
    showSashimiArcs,
  } = model

  const width =
    measuredDims.width ?? (view?.initialized ? view.width : undefined)
  const height = model.height

  const colorPaletteRef = useRef(colorPalette)
  colorPaletteRef.current = colorPalette
  const viewRef = useRef(view)
  viewRef.current = view
  const widthRef = useRef(width)
  widthRef.current = width

  function doRender() {
    const renderer = rendererRef.current
    if (!renderer || !view?.initialized) {
      return
    }
    const regions = view.visibleRegions
    const blocks = regions.map(r => ({
      regionNumber: r.regionNumber,
      bpRangeX: [r.start, r.end] as [number, number],
      screenStartPx: r.screenStartPx,
      screenEndPx: r.screenEndPx,
    }))
    renderer.renderBlocks(blocks, {
      rangeY: model.currentRangeY,
      colorScheme: model.colorSchemeIndex,
      featureHeight: model.featureHeightSetting,
      featureSpacing: model.featureSpacing,
      showCoverage: model.showCoverage,
      coverageHeight: model.coverageHeight,
      coverageYOffset: YSCALEBAR_LABEL_OFFSET,
      showMismatches: model.showMismatches,
      showInterbaseCounts: model.showInterbaseCounts,
      showInterbaseIndicators: model.showInterbaseIndicators,
      showModifications: model.showModifications,
      showSashimiArcs: model.showSashimiArcs,
      canvasWidth: view.width,
      canvasHeight: model.height,
      highlightedFeatureIndex: model.highlightedFeatureIndex,
      selectedFeatureIndex: model.selectedFeatureIndex,
      highlightedChainIndices: model.highlightedChainIndices,
      selectedChainIndices: model.selectedChainIndices,
      colors: colorPaletteRef.current,
      renderingMode: model.renderingMode,
      arcLineWidth: model.arcsState.lineWidth,
      cloudColorScheme: model.colorSchemeIndex,
      bpRangeX: [0, 0],
    })
  }

  function resolveBlockForCanvasX(canvasX: number): ResolvedBlock | undefined {
    if (!view?.initialized) {
      return undefined
    }

    const regions = view.visibleRegions
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
  }

  // --- Shared event handlers ---

  function handleMouseDown(e: React.MouseEvent) {
    e.stopPropagation()
    dragRef.current = { isDragging: true, lastX: e.clientX }
  }

  function handleDragMove(e: React.MouseEvent) {
    if (!dragRef.current.isDragging) {
      return
    }
    e.stopPropagation()

    if (!view || width === undefined) {
      return
    }

    const dx = e.clientX - dragRef.current.lastX
    dragRef.current.lastX = e.clientX

    if (dx !== 0) {
      const minOffset = view.minOffset ?? 0
      const maxOffset = view.maxOffset ?? Infinity
      const newOffsetPx = Math.max(
        minOffset,
        Math.min(maxOffset, view.offsetPx - dx),
      )
      view.setNewView(view.bpPerPx, newOffsetPx)
    }
  }

  function handleMouseUp() {
    dragRef.current.isDragging = false
  }

  function handleMouseLeave() {
    dragRef.current.isDragging = false
    model.setFeatureIdUnderMouse(undefined)
    model.setMouseoverExtraInformation(undefined)
    setOverCigarItem(false)
    model.clearHighlights()
  }

  function handleResizeMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    resizeDragRef.current = {
      isDragging: true,
      startY: e.clientY,
      startHeight: coverageHeight,
    }

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!resizeDragRef.current.isDragging) {
        return
      }
      const deltaY = moveEvent.clientY - resizeDragRef.current.startY
      const newHeight = Math.max(20, resizeDragRef.current.startHeight + deltaY)
      model.setCoverageHeight(newHeight)
    }

    const onMouseUp = () => {
      resizeDragRef.current.isDragging = false
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  function handleContextMenu(e: React.MouseEvent) {
    const coords = getCanvasCoords(e, canvasRef, canvasRectRef)
    if (!coords) {
      return
    }

    const resolved = resolveBlockForCanvasX(coords.canvasX)

    const result = performHitTest(coords.canvasX, coords.canvasY, resolved, {
      showCoverage,
      showInterbaseIndicators,
      showSashimiArcs,
      coverageHeight,
      featureHeightSetting,
      featureSpacing,
      rangeY: model.currentRangeY,
      isChainMode,
    })

    if (result.type === 'feature') {
      e.preventDefault()
      // TODO: implement proper context menu
      model.selectFeatureById(result.hit.id)
    }
  }

  // --- Hit test processing helpers ---

  function processMouseMove(
    e: React.MouseEvent,
    onFeature: (hit: FeatureHit, resolved: ResolvedBlock) => void,
    onNoFeature: () => void,
  ) {
    if (dragRef.current.isDragging) {
      handleDragMove(e)
      return
    }

    const coords = getCanvasCoords(e, canvasRef, canvasRectRef)
    if (!coords) {
      return
    }
    const { canvasX, canvasY } = coords

    const resolved = resolveBlockForCanvasX(canvasX)

    const result = performHitTest(canvasX, canvasY, resolved, {
      showCoverage,
      showInterbaseIndicators,
      showSashimiArcs,
      coverageHeight,
      featureHeightSetting,
      featureSpacing,
      rangeY: model.currentRangeY,
      isChainMode,
    })

    if (result.type === 'indicator') {
      setOverCigarItem(true)
      model.setFeatureIdUnderMouse(undefined)
      model.setMouseoverExtraInformation(
        formatIndicatorTooltip(
          result.hit,
          result.resolved.rpcData,
          result.resolved.refName,
        ),
      )
      model.clearHighlights()
      return
    }

    if (result.type === 'sashimi') {
      setOverCigarItem(true)
      model.setFeatureIdUnderMouse(undefined)
      model.setMouseoverExtraInformation(formatSashimiTooltip(result.hit))
      model.clearHighlights()
      return
    }

    if (result.type === 'coverage') {
      setOverCigarItem(true)
      model.setFeatureIdUnderMouse(undefined)
      model.setMouseoverExtraInformation(
        formatCoverageTooltip(
          result.hit,
          result.resolved.rpcData,
          result.resolved.refName,
        ),
      )
      model.clearHighlights()
      return
    }

    if (result.type === 'cigar') {
      setOverCigarItem(true)
      model.setMouseoverExtraInformation(formatCigarTooltip(result.hit))
      const featureId = result.featureHit?.id
      const featureIndex = result.featureHit?.index ?? -1
      model.setFeatureIdUnderMouse(featureId)
      if (model.highlightedFeatureIndex !== featureIndex) {
        model.setHighlightedFeatureIndex(featureIndex)
      }
      return
    }

    setOverCigarItem(false)

    if (result.type === 'feature') {
      onFeature(result.hit, result.resolved)
    } else {
      onNoFeature()
    }
  }

  function processClick(
    e: React.MouseEvent,
    onFeature: (hit: FeatureHit, resolved: ResolvedBlock) => void,
    onNoFeature: () => void,
  ) {
    const coords = getCanvasCoords(e, canvasRef, canvasRectRef)
    if (!coords) {
      return
    }
    const { canvasX, canvasY } = coords

    const resolved = resolveBlockForCanvasX(canvasX)

    const result = performHitTest(canvasX, canvasY, resolved, {
      showCoverage,
      showInterbaseIndicators,
      showSashimiArcs,
      coverageHeight,
      featureHeightSetting,
      featureSpacing,
      rangeY: model.currentRangeY,
      isChainMode,
    })

    if (result.type === 'indicator') {
      const refName =
        result.resolved.refName ?? model.loadedRegion?.refName ?? ''
      openIndicatorWidget(model, result.hit, refName, result.resolved.rpcData)
      return
    }

    if (result.type === 'coverage') {
      const refName =
        result.resolved.refName ?? model.loadedRegion?.refName ?? ''
      openCoverageWidget(model, result.hit, refName, result.resolved.rpcData)
      return
    }

    if (result.type === 'cigar') {
      const refName =
        result.resolved.refName ?? model.loadedRegion?.refName ?? ''
      if (result.featureHit) {
        model.setSelectedFeatureIndex(result.featureHit.index)
      }
      openCigarWidget(model, result.hit, refName)
      return
    }

    if (result.type === 'feature') {
      onFeature(result.hit, result.resolved)
    } else {
      onNoFeature()
    }
  }

  // --- Effects ---

  // Initialize WebGL renderer (DOM lifecycle)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    try {
      rendererRef.current = new WebGLRenderer(canvas)
    } catch (e) {
      console.error('Failed to initialize WebGL:', e)
    }
    return () => {
      rendererRef.current?.destroy()
      rendererRef.current = null
    }
  }, [])

  // Coordinator subscription for cross-canvas sync
  useEffect(() => {
    const viewId = view.id
    if (!viewId) {
      return
    }
    const coordinator = getCoordinator(viewId)
    const unsubscribe = coordinator.subscribe(canvasId, () => {
      doRender()
    })
    return () => {
      unsubscribe()
      if (coordinator.listenerCount === 0) {
        removeCoordinator(viewId)
      }
    }
  }, [view.id, canvasId])

  // Single render autorun: tracks all relevant MobX observables and renders
  useEffect(() => {
    if (!view) {
      return
    }
    const dispose = autorun(
      () => {
        doRender()
      },
      { name: 'WebGLAlignmentsComponent:render' },
    )
    return dispose
  }, [view, model])

  // Upload pileup data to GPU
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
      model.setMaxY(maxYVal)
    }
    doRender()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rpcDataMap, showCoverage])

  // Wheel handler (needs passive:false, must use addEventListener)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const handleWheel = (e: WheelEvent) => {
      const v = viewRef.current
      const w = widthRef.current

      if (!v?.initialized || w === undefined) {
        return
      }

      const absX = Math.abs(e.deltaX)
      const absY = Math.abs(e.deltaY)

      if (absX > 5 && absX > absY * 2) {
        e.preventDefault()
        e.stopPropagation()
        const minOff = v.minOffset ?? 0
        const maxOff = v.maxOffset ?? Infinity
        const newOffsetPx = Math.max(
          minOff,
          Math.min(maxOff, v.offsetPx + e.deltaX),
        )
        v.setNewView(v.bpPerPx, newOffsetPx)
        return
      }

      if (absY < 1) {
        return
      }

      if (e.shiftKey) {
        e.preventDefault()
        e.stopPropagation()
        const rowHeight = model.featureHeightSetting + model.featureSpacing
        const totalHeight = model.maxY * rowHeight
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

  // --- Derived state ---

  const visibleLabels = computeVisibleLabels({
    rpcData,
    labelBpRange: model.visibleBpRange,
    width,
    height,
    featureHeightSetting,
    featureSpacing,
    showMismatches,
    showCoverage,
    coverageHeight,
    rangeY: model.currentRangeY,
  })

  return {
    canvasRef,
    rendererRef,
    measureRef,
    overCigarItem,
    resizeHandleHovered,
    setResizeHandleHovered,
    view,
    width,
    height,
    contrastMap,
    statusMessage,
    handleMouseDown,
    handleMouseUp,
    handleMouseLeave,
    handleResizeMouseDown,
    handleContextMenu,
    processMouseMove,
    processClick,
    doRender,
    visibleLabels,
  }
}
