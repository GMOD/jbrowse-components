import type React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { getContainingView, useGpuModelLifecycle } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'

import { AlignmentsRenderer } from './AlignmentsRenderer.ts'
import {
  buildColorPaletteFromTheme,
  getCanvasCoords,
} from './alignmentComponentUtils.ts'
import { performHitTest } from './hitTestPipeline.ts'
import {
  openCigarWidget,
  openCoverageWidget,
  openIndicatorWidget,
} from './openFeatureWidget.ts'
import {
  formatCigarTooltip,
  formatCoverageTooltip,
  formatIndicatorTooltip,
  formatModificationTooltip,
} from './tooltipUtils.ts'
import { getContrastBaseMap } from '../../shared/util.ts'

import type { ResolvedBlock } from '../../shared/hitTestTypes.ts'
import type { LinearAlignmentsDisplayModel } from '../model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// eslint-disable-next-line unicorn/prefer-export-from -- also used locally in function signatures
export type { LinearAlignmentsDisplayModel }

export interface FeatureHit {
  id: string
  index: number
}

function makeResizeHandler(
  getHeight: () => number,
  setHeight: (h: number) => void,
) {
  return (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startY = e.clientY
    const startHeight = getHeight()
    const onMouseMove = (moveEvent: MouseEvent) => {
      setHeight(Math.max(20, startHeight + moveEvent.clientY - startY))
    }
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }
}

export function useAlignmentsBase(model: LinearAlignmentsDisplayModel) {
  const {
    canvas,
    canvasRef,
    error: gpuError,
    retry,
  } = useGpuModelLifecycle(AlignmentsRenderer, model)
  const [resizeHandleHovered, setResizeHandleHovered] = useState(false)
  const [arcsResizeHovered, setArcsResizeHovered] = useState(false)
  const [sashimiResizeHovered, setSashimiResizeHovered] = useState(false)

  const canvasRectRef = useRef<{ rect: DOMRect; timestamp: number } | null>(
    null,
  )
  const dragRef = useRef({ isDragging: false, lastX: 0 })

  const view = getContainingView(model) as LinearGenomeViewModel
  const theme = useTheme()
  const colorPalette = useMemo(() => buildColorPaletteFromTheme(theme), [theme])
  const contrastMap = useMemo(() => getContrastBaseMap(theme), [theme])

  const {
    featureHeightSetting,
    featureSpacing,
    showCoverage,
    coverageHeight,
    arcsHeight,
    coverageDisplayHeight: topOffset,
    showInterbaseIndicators,
    isChainMode,
  } = model

  const width = view.initialized ? view.width : undefined

  function runHitTest(canvasX: number, canvasY: number) {
    const resolved = resolveBlockForCanvasX(canvasX)
    return {
      resolved,
      result: performHitTest(canvasX, canvasY, resolved, {
        showCoverage,
        showInterbaseIndicators,
        coverageHeight,
        topOffset,
        featureHeightSetting,
        featureSpacing,
        rangeY: model.currentRangeY,
        isChainMode,
      }),
    }
  }

  function resolveBlockForCanvasX(canvasX: number): ResolvedBlock | undefined {
    if (!view.initialized) {
      return undefined
    }

    const regions = view.visibleRegions
    const dataMap = model.laidOutPileupMap

    for (const r of regions) {
      if (canvasX >= r.screenStartPx && canvasX < r.screenEndPx) {
        const data = dataMap.get(r.displayedRegionIndex)
        if (data) {
          return {
            rpcData: data,
            bpRange: [r.start, r.end],
            blockStartPx: r.screenStartPx,
            blockWidth: r.screenEndPx - r.screenStartPx,
            refName: r.refName,
            reversed: r.reversed ?? false,
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
    if (!model.contextMenuCoord) {
      model.clearMouseoverState()
    }
  }

  const handleResizeMouseDown = makeResizeHandler(
    () => coverageHeight,
    h => {
      model.setCoverageHeight(h)
    },
  )

  const handleArcsResizeMouseDown = makeResizeHandler(
    () => arcsHeight,
    h => {
      model.setArcsHeight(h)
    },
  )

  const handleSashimiArcsResizeMouseDown = makeResizeHandler(
    () => model.sashimiArcsHeight,
    h => {
      model.setSashimiArcsHeight(h)
    },
  )

  function handleContextMenu(e: React.MouseEvent) {
    const coords = getCanvasCoords(e, canvas, canvasRectRef)
    if (!coords) {
      return
    }

    const { resolved, result } = runHitTest(coords.canvasX, coords.canvasY)
    if (
      result.type === 'cigar' ||
      result.type === 'indicator' ||
      result.type === 'feature'
    ) {
      e.preventDefault()
      model.setContextMenuCoord([e.clientX, e.clientY])
      model.setContextMenuRefName(resolved?.refName)
      model.setContextMenuCigarHit(
        result.type === 'cigar' ? result.hit : undefined,
      )
      model.setContextMenuIndicatorHit(
        result.type === 'indicator' ? result.hit : undefined,
      )
      if (result.type === 'cigar' && result.featureHit) {
        void model.setContextMenuFeatureById(result.featureHit.id)
      } else if (result.type === 'feature') {
        void model.setContextMenuFeatureById(result.hit.id)
      }
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

    const coords = getCanvasCoords(e, canvas, canvasRectRef)
    if (!coords) {
      return
    }

    const { result } = runHitTest(coords.canvasX, coords.canvasY)

    switch (result.type) {
      case 'indicator':
        model.setHoverState({
          overCigarItem: true,
          featureIdUnderMouse: undefined,
          mouseoverExtraInformation: formatIndicatorTooltip(
            result.hit.position,
            result.resolved.rpcData,
            result.resolved.refName,
          ),
        })
        model.clearHighlights()
        return
      case 'coverage':
        model.setHoverState({
          overCigarItem: true,
          featureIdUnderMouse: undefined,
          mouseoverExtraInformation: formatCoverageTooltip(
            result.hit.position,
            result.resolved.rpcData,
            result.resolved.refName,
          ),
        })
        model.clearHighlights()
        return
      case 'modification': {
        const snpBase =
          result.cigarHit?.type === 'mismatch'
            ? result.cigarHit.base
            : undefined
        model.setHoverState({
          overCigarItem: true,
          featureIdUnderMouse: result.featureHit?.id,
          mouseoverExtraInformation: formatModificationTooltip(
            result.hit.position,
            result.hit.modType,
            result.hit.probability,
            result.hit.color,
            result.resolved.refName,
            snpBase,
          ),
        })
        return
      }
      case 'cigar':
        model.setHoverState({
          overCigarItem: true,
          featureIdUnderMouse: result.featureHit?.id,
          mouseoverExtraInformation: formatCigarTooltip(result.hit),
        })
        return
      case 'feature':
        model.setOverCigarItem(false)
        onFeature(result.hit, result.resolved)
        return
      case 'none':
        model.setOverCigarItem(false)
        onNoFeature()
        return
    }
  }

  function processClick(
    e: React.MouseEvent,
    onFeature: (hit: FeatureHit, resolved: ResolvedBlock) => void,
    onNoFeature: () => void,
  ) {
    const coords = getCanvasCoords(e, canvas, canvasRectRef)
    if (!coords) {
      return
    }
    const { canvasX, canvasY } = coords

    const { result } = runHitTest(canvasX, canvasY)

    switch (result.type) {
      case 'indicator':
        openIndicatorWidget(
          model,
          result.hit,
          result.resolved.refName,
          result.resolved.rpcData,
        )
        return
      case 'coverage':
        openCoverageWidget(
          model,
          result.hit.position,
          result.resolved.refName,
          result.resolved.rpcData,
        )
        return
      case 'cigar':
        openCigarWidget(model, result.hit, result.resolved.refName)
        return
      case 'modification':
        openCoverageWidget(
          model,
          result.hit.position,
          result.resolved.refName,
          result.resolved.rpcData,
          result.hit.modType,
        )
        return
      case 'feature':
        onFeature(result.hit, result.resolved)
        return
      case 'none':
        onNoFeature()
        return
    }
  }

  // --- Effects ---

  useEffect(() => {
    model.setColorPalette(colorPalette)
  }, [model, colorPalette])

  return {
    canvas,
    canvasRef,
    gpuError,
    retry,
    resizeHandleHovered,
    setResizeHandleHovered,
    width,
    contrastMap,
    handleMouseDown,
    handleMouseUp,
    handleMouseLeave,
    handleResizeMouseDown,
    handleArcsResizeMouseDown,
    arcsResizeHovered,
    setArcsResizeHovered,
    handleSashimiArcsResizeMouseDown,
    sashimiResizeHovered,
    setSashimiResizeHovered,
    handleContextMenu,
    processMouseMove,
    processClick,
  }
}
