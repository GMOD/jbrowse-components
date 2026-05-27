import type React from 'react'
import { useEffect, useMemo, useRef } from 'react'

import { clamp, getContainingView, useGpuBackend } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'

import { AlignmentsRenderer } from './AlignmentsRenderer.ts'
import {
  CLICK_SUPPRESS_THRESHOLD_PX,
  buildColorPaletteFromTheme,
  getCanvasCoords,
  isDragInProgress,
  startDocumentDrag,
  useAbortableRef,
} from './alignmentComponentUtils.ts'
import { performHitTest } from './hitTestPipeline.ts'
import {
  openCigarWidget,
  openCoverageWidget,
  openIndicatorWidget,
  openModificationWidget,
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

export function useAlignmentsBase(model: LinearAlignmentsDisplayModel) {
  const {
    canvas,
    canvasRef,
    error: gpuError,
    retry,
  } = useGpuBackend(AlignmentsRenderer, model)

  const canvasRectRef = useRef<{ rect: DOMRect; timestamp: number } | null>(
    null,
  )
  // Tracks the currently-active pan drag. Starting a new pan aborts the
  // previous and unmount aborts in-flight. Doubles as the "is dragging"
  // source of truth via isDragInProgress; no parallel boolean state needed.
  // Resize handles and scrollbar manage their own drags independently.
  const dragControllerRef = useAbortableRef()
  // Suppresses the trailing click that fires when a pan ends inside the canvas.
  const dragMovedRef = useRef(false)

  const view = getContainingView(model) as LinearGenomeViewModel
  const theme = useTheme()
  const colorPalette = useMemo(() => buildColorPaletteFromTheme(theme), [theme])
  const contrastMap = useMemo(() => getContrastBaseMap(theme), [theme])

  const {
    featureHeightSetting,
    featureSpacing,
    showCoverage,
    coverageHeight,
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
    dragMovedRef.current = false
    const startOffsetPx = view.offsetPx
    startDocumentDrag(e, dragControllerRef, (dx, dy) => {
      if (
        !dragMovedRef.current &&
        Math.abs(dx) + Math.abs(dy) > CLICK_SUPPRESS_THRESHOLD_PX
      ) {
        dragMovedRef.current = true
      }
      view.setNewView(
        view.bpPerPx,
        clamp(startOffsetPx - dx, view.minOffset, view.maxOffset),
      )
    })
  }

  function handleMouseLeave() {
    if (!model.contextMenuCoord) {
      model.clearMouseoverState()
    }
  }

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
    if (isDragInProgress(dragControllerRef)) {
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
    // click fires after mousedown+mouseup regardless of motion in between.
    if (dragMovedRef.current) {
      dragMovedRef.current = false
      return
    }
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
      case 'modification': {
        const snpBase =
          result.cigarHit?.type === 'mismatch' ? result.cigarHit.base : undefined
        openModificationWidget(
          model,
          result.hit,
          result.resolved.refName,
          snpBase,
        )
        return
      }
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
    width,
    contrastMap,
    handleMouseDown,
    handleMouseLeave,
    handleContextMenu,
    processMouseMove,
    processClick,
  }
}
