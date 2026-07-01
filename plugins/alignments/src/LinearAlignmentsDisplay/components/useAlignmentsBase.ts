import type React from 'react'
import { useMemo, useRef } from 'react'

import { clamp, getContainingView } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'

import {
  CLICK_SUPPRESS_THRESHOLD_PX,
  getCanvasCoords,
  isDragInProgress,
  startDocumentDrag,
  useAbortableRef,
} from './alignmentComponentUtils.ts'
import {
  openCigarWidget,
  openCoverageWidget,
  openIndicatorWidget,
  openModificationWidget,
} from './detailWidgets.ts'
import { findSectionAtY } from './findSectionAtY.ts'
import { performHitTest } from './hitTestPipeline.ts'
import {
  formatCigarTooltip,
  formatCoverageTooltip,
  formatIndicatorTooltip,
  formatModificationTooltip,
} from './tooltipUtils.ts'
import { getMismatchContrastMap } from '../../shared/util.ts'

import type { ResolvedBlock } from '../../shared/hitTestTypes.ts'
import type { LinearAlignmentsDisplayModel } from '../model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export type { LinearAlignmentsDisplayModel }

export interface FeatureHit {
  id: string
  index: number
}

// Hit-test handlers + theme plumbing for the pileup canvas. The GPU backend
// lifecycle is owned by DisplayChrome, which hands the live `canvas` down; this
// hook only needs it to map mouse events to canvas coordinates.
export function useAlignmentsBase(
  model: LinearAlignmentsDisplayModel,
  canvas: HTMLCanvasElement | null,
) {
  const view = getContainingView(model) as LinearGenomeViewModel
  const width = view.initialized ? view.width : undefined

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

  const theme = useTheme()
  const contrastMap = useMemo(
    () =>
      getMismatchContrastMap(
        model.colorBy.type,
        model.showModifications,
        theme,
      ),
    [theme, model.colorBy.type, model.showModifications],
  )

  const {
    featureHeight,
    featureSpacing,
    showCoverage,
    coverageHeight,
    showInterbaseIndicators,
    isChainMode,
  } = model

  function runHitTest(canvasX: number, canvasY: number) {
    const picked = resolveSectionForCanvasY(canvasY)
    const resolved = picked
      ? resolveBlockForCanvasX(canvasX, picked.section.laidOutPileupMap)
      : undefined
    return {
      resolved,
      picked,
      result: performHitTest(canvasX, canvasY, resolved, {
        showCoverage,
        showInterbaseIndicators,
        coverageHeight,
        topOffset: picked?.section.topOffset ?? model.coverageDisplayHeight,
        coverageTopOffset: picked?.coverageTopOffset ?? 0,
        featureHeight,
        featureSpacing,
        scrollTop: model.scrollTop,
        isChainMode,
        pileupVisible: (picked?.section.pileupHeight ?? 0) > 0,
      }),
    }
  }

  function resolveSectionForCanvasY(canvasY: number) {
    return findSectionAtY(model.renderSections, canvasY, {
      isGrouped: model.isGrouped,
      scrollTop: model.scrollTop,
      contentHeight: model.sections.contentHeight,
    })
  }

  function resolveBlockForCanvasX(
    canvasX: number,
    dataMap: { get(idx: number): ResolvedBlock['rpcData'] | undefined },
  ): ResolvedBlock | undefined {
    if (!view.initialized) {
      return undefined
    }

    const regions = view.visibleRegions

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
      dragMovedRef.current ||=
        Math.abs(dx) + Math.abs(dy) > CLICK_SUPPRESS_THRESHOLD_PX
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
    if (['cigar', 'indicator', 'feature'].includes(result.type)) {
      e.preventDefault()
      model.clearMouseoverState()
      model.setContextMenuCoord([e.clientX, e.clientY])
      model.setContextMenuRefName(resolved?.refName)
      model.setContextMenuRpcData(resolved?.rpcData)
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

    const { result, picked } = runHitTest(coords.canvasX, coords.canvasY)

    // Screen-px coverage band of the hovered section, so the tooltip's vertical
    // bar lands on the hovered group's coverage band rather than always the top.
    const hoverCoverageBand = picked
      ? {
          topOffset: picked.coverageTopOffset,
          coverageHeight: picked.section.coverageHeight,
        }
      : undefined

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
          hoverCoverageBand,
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
          hoverCoverageBand,
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
          result.cigarHit?.type === 'mismatch'
            ? result.cigarHit.base
            : undefined
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

  return {
    width,
    contrastMap,
    handleMouseDown,
    handleMouseLeave,
    handleContextMenu,
    processMouseMove,
    processClick,
  }
}
