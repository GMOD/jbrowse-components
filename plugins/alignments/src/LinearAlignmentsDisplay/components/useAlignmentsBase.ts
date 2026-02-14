import { useEffect, useMemo, useRef, useState } from 'react'

import {
  getContainingView,
  setupWebGLContextLossHandler,
} from '@jbrowse/core/util'
import { useTheme } from '@mui/material'

import { WebGLRenderer } from './WebGLRenderer.ts'
import {
  buildColorPaletteFromTheme,
  formatCigarTooltip,
  formatCoverageTooltip,
  formatIndicatorTooltip,
  formatSashimiTooltip,
  getCanvasCoords,
} from './alignmentComponentUtils.ts'
import { performHitTest } from './hitTestPipeline.ts'
import {
  openCigarWidget,
  openCoverageWidget,
  openIndicatorWidget,
} from './openFeatureWidget.ts'
import { getContrastBaseMap } from '../../shared/util.ts'

import type { CloudTicks } from './CloudYScaleBar.tsx'
import type { CoverageTicks } from './CoverageYScaleBar.tsx'
import type { ColorPalette } from './WebGLRenderer.ts'
import type { VisibleLabel } from './computeVisibleLabels.ts'
import type {
  CigarHitResult,
  IndicatorHitResult,
  ResolvedBlock,
} from './hitTesting.ts'
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

export interface LinearAlignmentsDisplayModel {
  height: number
  rpcDataMap: Map<number, WebGLPileupDataResult>
  loadedRegion: { refName: string; start: number; end: number } | null
  showLoading: boolean
  statusMessage?: string
  error: Error | null
  featureHeightSetting: number
  featureSpacing: number
  showCoverage: boolean
  coverageHeight: number
  showInterbaseIndicators: boolean
  showSashimiArcs: boolean
  maxY: number
  regionTooLarge: boolean
  regionTooLargeReason: string
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
  overCigarItem: boolean
  visibleLabels: VisibleLabel[]
  isChainMode: boolean
  setOverCigarItem: (flag: boolean) => void
  setWebGLRenderer: (renderer: WebGLRenderer | null) => void
  setColorPalette: (palette: ColorPalette | null) => void
  setCurrentRangeY: (rangeY: [number, number]) => void
  setCoverageHeight: (height: number) => void
  setHighlightedFeatureIndex: (index: number) => void
  setSelectedFeatureIndex: (index: number) => void
  setHighlightedChainIndices: (indices: number[]) => void
  setSelectedChainIndices: (indices: number[]) => void
  clearHighlights: () => void
  clearMouseoverState: () => void
  clearSelection: () => void
  setFeatureIdUnderMouse: (id: string | undefined) => void
  setMouseoverExtraInformation: (info: string | undefined) => void
  selectFeatureById: (featureId: string) => void
  setContextMenuFeatureById: (featureId: string) => void
  setContextMenuCoord: (coord?: [number, number]) => void
  setContextMenuCigarHit: (hit?: CigarHitResult) => void
  setContextMenuIndicatorHit: (hit?: IndicatorHitResult) => void
  contextMenuCoord: [number, number] | undefined
  contextMenuItems: () => {
    label: string
    onClick: () => void
    icon?: unknown
  }[]
  setContextMenuFeature: (feature?: unknown) => void
  getFeatureInfoById: (featureId: string) => FeatureInfo | undefined
  renderingMode: 'pileup' | 'arcs' | 'cloud' | 'linkedRead'
  clearAllRpcData: () => void
}

export interface FeatureHit {
  id: string
  index: number
}

export function useAlignmentsBase(model: LinearAlignmentsDisplayModel) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
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
    featureHeightSetting,
    featureSpacing,
    showCoverage,
    coverageHeight,
    showInterbaseIndicators,
    showSashimiArcs,
    isChainMode,
  } = model

  const width = view.initialized ? view.width : undefined

  const viewRef = useRef(view)

  useEffect(() => {
    viewRef.current = view
  })

  function resolveBlockForCanvasX(canvasX: number): ResolvedBlock | undefined {
    if (!view.initialized) {
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

    const dx = e.clientX - dragRef.current.lastX
    dragRef.current.lastX = e.clientX

    if (dx !== 0) {
      const minOffset = view.minOffset
      const maxOffset = view.maxOffset
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
    model.clearMouseoverState()
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

    if (result.type === 'cigar') {
      e.preventDefault()
      model.setContextMenuCoord([e.clientX, e.clientY])
      model.setContextMenuCigarHit(result.hit)
      model.setContextMenuIndicatorHit(undefined)
      if (result.featureHit) {
        model.setContextMenuFeatureById(result.featureHit.id)
      }
    } else if (result.type === 'indicator') {
      e.preventDefault()
      model.setContextMenuCoord([e.clientX, e.clientY])
      model.setContextMenuCigarHit(undefined)
      model.setContextMenuIndicatorHit(result.hit)
    } else if (result.type === 'feature') {
      e.preventDefault()
      model.setContextMenuCoord([e.clientX, e.clientY])
      model.setContextMenuCigarHit(undefined)
      model.setContextMenuIndicatorHit(undefined)
      model.setContextMenuFeatureById(result.hit.id)
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

    if (result.type === 'indicator') {
      model.setOverCigarItem(true)
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
      model.setOverCigarItem(true)
      model.setFeatureIdUnderMouse(undefined)
      model.setMouseoverExtraInformation(formatSashimiTooltip(result.hit))
      model.clearHighlights()
      return
    }

    if (result.type === 'coverage') {
      model.setOverCigarItem(true)
      model.setFeatureIdUnderMouse(undefined)
      model.setMouseoverExtraInformation(
        formatCoverageTooltip(
          result.hit.position,
          result.resolved.rpcData,
          result.resolved.refName,
        ),
      )
      model.clearHighlights()
      return
    }

    if (result.type === 'cigar') {
      model.setOverCigarItem(true)
      model.setMouseoverExtraInformation(formatCigarTooltip(result.hit))
      const featureId = result.featureHit?.id
      const featureIndex = result.featureHit?.index ?? -1
      model.setFeatureIdUnderMouse(featureId)
      if (model.highlightedFeatureIndex !== featureIndex) {
        model.setHighlightedFeatureIndex(featureIndex)
      }
      return
    }

    model.setOverCigarItem(false)

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
      const refName = result.resolved.refName
      openIndicatorWidget(model, result.hit, refName, result.resolved.rpcData)
      return
    }

    if (result.type === 'coverage') {
      const refName = result.resolved.refName
      openCoverageWidget(model, result.hit.position, refName, result.resolved.rpcData)
      return
    }

    if (result.type === 'cigar') {
      const refName = result.resolved.refName
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

  const rendererRef = useRef<WebGLRenderer | null>(null)
  const [contextVersion, setContextVersion] = useState(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) {
      return setupWebGLContextLossHandler(canvas, () => {
        setContextVersion(v => v + 1)
      })
    }
    return undefined
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    try {
      rendererRef.current = new WebGLRenderer(canvas)
      model.setWebGLRenderer(rendererRef.current)
      if (contextVersion > 0) {
        model.clearAllRpcData()
      }
    } catch (e) {
      console.error('Failed to initialize WebGL:', e)
    }
    return () => {
      rendererRef.current?.destroy()
      rendererRef.current = null
      model.setWebGLRenderer(null)
    }
  }, [contextVersion, model])

  // Sync theme-derived color palette to model
  useEffect(() => {
    model.setColorPalette(colorPalette)
  }, [model, colorPalette])

  // Wheel handler (needs passive:false, must use addEventListener)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const handleWheel = (e: WheelEvent) => {
      const v = viewRef.current

      if (!v.initialized) {
        return
      }

      const absX = Math.abs(e.deltaX)
      const absY = Math.abs(e.deltaY)

      if (absX > 5 && absX > absY * 2) {
        e.preventDefault()
        e.stopPropagation()
        const minOff = v.minOffset
        const maxOff = v.maxOffset
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

  return {
    canvasRef,
    resizeHandleHovered,
    setResizeHandleHovered,
    width,
    contrastMap,
    handleMouseDown,
    handleMouseUp,
    handleMouseLeave,
    handleResizeMouseDown,
    handleContextMenu,
    processMouseMove,
    processClick,
  }
}
