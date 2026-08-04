import { useMemo, useRef } from 'react'

import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { clamp, getContainingView } from '@jbrowse/core/util'

import { getMismatchContrastMap } from '../../shared/util.ts'
import {
  CLICK_SUPPRESS_THRESHOLD_PX,
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
import {
  canvasXToBasePos,
  contextMenuFieldsForHit,
  performHitTest,
} from './hitTestPipeline.ts'
import {
  formatChainTooltip,
  formatCigarTooltip,
  formatCoverageTooltip,
  formatFeatureTooltip,
  formatIndicatorTooltip,
  formatModificationTooltip,
} from './tooltipUtils.ts'

import type {
  CigarHitResult,
  ResolvedBlock,
} from '../../shared/hitTestTypes.ts'
import type { LinearAlignmentsDisplayModel } from '../model.ts'
import type { HitTestResult } from './hitTestPipeline.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type React from 'react'

export type { LinearAlignmentsDisplayModel }

export interface FeatureHit {
  id: string
  index: number
}

// The SNP base to annotate a modification hit with, when the modified base is
// also a mismatch. undefined for a modification over a reference-matching base.
function snpBaseFromCigar(cigarHit: CigarHitResult | undefined) {
  return cigarHit?.type === 'mismatch' ? cigarHit.base : undefined
}

// Hit-test handlers + palette plumbing for the pileup canvas. Mouse coords come
// straight off the native event (`offsetX`/`offsetY`, canvas-relative since the
// canvas is a borderless leaf element), so no canvas ref or rect math is needed.
export function useAlignmentsBase(model: LinearAlignmentsDisplayModel) {
  const view = getContainingView(model) as LinearGenomeViewModel
  const width = view.initialized ? view.width : undefined

  // Tracks the currently-active pan drag. Starting a new pan aborts the
  // previous and unmount aborts in-flight. Doubles as the "is dragging"
  // source of truth via isDragInProgress; no parallel boolean state needed.
  // Resize handles and scrollbar manage their own drags independently.
  const dragControllerRef = useAbortableRef()
  // Suppresses the trailing click that fires when a pan ends inside the canvas.
  const dragMovedRef = useRef(false)

  const palette = usePalette()
  const contrastMap = useMemo(
    () => getMismatchContrastMap(model.showModifications, palette),
    [palette, model.showModifications],
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
    // No section under the cursor, or no fetched block at that x, is a miss.
    // Answering it here is what lets performHitTest take a definite block and
    // read the section's real offsets rather than standing in for a missing one.
    const result: HitTestResult =
      picked && resolved
        ? performHitTest(canvasX, canvasY, resolved, {
            showCoverage,
            showInterbaseIndicators,
            coverageHeight,
            coverageMaxDepth: model.coverageDomain?.[1],
            topOffset: picked.section.topOffset,
            coverageTopOffset: picked.coverageTopOffset,
            featureHeight,
            featureSpacing,
            scrollTop: model.scrollTop,
            isChainMode,
            filterMismatchesByFrequency: model.filterMismatchesByFrequency,
            pileupVisible: picked.section.pileupHeight > 0,
          })
        : { type: 'none' }
    return { resolved, picked, result }
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

  // Maps a canvas mouse event to canvas coordinates and runs the full hit-test
  // pipeline. Shared by the context-menu, click, and move handlers so the coord
  // + hit-test preamble lives in one place.
  function hitTestEvent(e: React.MouseEvent) {
    const { offsetX, offsetY } = e.nativeEvent
    return runHitTest(offsetX, offsetY)
  }

  // --- Shared event handlers ---

  function handleMouseDown(e: React.MouseEvent) {
    // Only the primary button pans. A right/middle press must fall through to
    // the native context menu / autoscroll rather than starting a document pan
    // drag (which also flips dragMovedRef and would swallow a later click).
    if (e.button !== 0) {
      return
    }
    // Shift+drag is the view's rubberband region-select gesture, not a pan.
    // Don't stopPropagation (startDocumentDrag does that) — let it bubble to
    // the LGV's TracksContainer, which checks event.shiftKey itself.
    if (e.shiftKey) {
      return
    }
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
    if (!model.contextMenuAnchor) {
      model.clearMouseoverState()
    }
  }

  function handleContextMenu(e: React.MouseEvent) {
    const { resolved, result } = hitTestEvent(e)
    const { show, cigarHit, indicatorHit, modHit, featureId } =
      contextMenuFieldsForHit(result)
    if (show) {
      e.preventDefault()
      model.clearMouseoverState()
      // The genomic column under the cursor, anchoring the read menu's "sort at
      // the clicked position" items (independent of whether a cigar feature was
      // hit). Same transform the hit-test pipeline uses.
      const genomicPos = resolved
        ? canvasXToBasePos(e.nativeEvent.offsetX, resolved)
        : undefined
      // One atomic call: coord + block + hits, plus the async read fetch when
      // the hit carries one. A repositioned menu can't inherit the prior read.
      model.openContextMenu({
        anchor: { clientX: e.clientX, clientY: e.clientY },
        block: resolved,
        genomicPos,
        cigarHit,
        indicatorHit,
        modHit,
        featureId,
      })
    }
  }

  // --- Hit test processing helpers ---

  // The chain a hovered read belongs to, for the chain highlight. Empty outside
  // chain mode, and empty for a cigar/modification hit that resolved no read.
  // Keeping it keyed off the read (rather than only the bare-body branch) is what
  // stops the previous read's highlight going stale while the cursor sits on a
  // mismatch or modified base.
  function hoveredChainIds(
    featureHit: FeatureHit | undefined,
    resolved: ResolvedBlock,
  ) {
    return model.isChainMode && featureHit
      ? model.chainIdsForRead(resolved.rpcData, featureHit.index)
      : []
  }

  function handleCanvasMouseMove(e: React.MouseEvent) {
    if (isDragInProgress(dragControllerRef)) {
      return
    }

    const { result, picked } = hitTestEvent(e)

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
      case 'coverage': {
        // Both bands are hit-tested by position alone, so the cursor can land on
        // a column with nothing to report (a coverage gap on targeted data).
        // `overCigarItem` drives the pointer cursor and the click opens the same
        // bin, so gate it on there being a tooltip — otherwise a gap showed a
        // pointer over a column that neither tooltips nor opens anything.
        const tooltip =
          result.type === 'indicator'
            ? formatIndicatorTooltip(
                result.hit.position,
                result.resolved.rpcData,
                result.resolved.refName,
              )
            : formatCoverageTooltip(
                result.hit.position,
                result.resolved.rpcData,
                result.resolved.refName,
              )
        model.setHoverState({
          overCigarItem: tooltip !== undefined,
          featureIdUnderMouse: undefined,
          mouseoverExtraInformation: tooltip,
          hoverCoverageBand,
          highlightedChainIds: [],
        })
        return
      }
      case 'modification':
        model.setHoverState({
          overCigarItem: true,
          featureIdUnderMouse: result.featureHit?.id,
          mouseoverExtraInformation: formatModificationTooltip(
            result.hit,
            result.resolved.refName,
            snpBaseFromCigar(result.cigarHit),
          ),
          hoverCoverageBand,
          highlightedChainIds: hoveredChainIds(
            result.featureHit,
            result.resolved,
          ),
        })
        return
      case 'cigar':
        model.setHoverState({
          overCigarItem: true,
          featureIdUnderMouse: result.featureHit?.id,
          mouseoverExtraInformation: formatCigarTooltip(result.hit),
          hoverCoverageBand,
          highlightedChainIds: hoveredChainIds(
            result.featureHit,
            result.resolved,
          ),
        })
        return
      case 'feature': {
        const { hit, resolved } = result
        model.setHoverState({
          overCigarItem: false,
          featureIdUnderMouse: hit.id,
          // A chain reports the whole template (both mates, insert size, pair
          // anomalies); a plain read reports just its own name and span.
          mouseoverExtraInformation: model.isChainMode
            ? formatChainTooltip(resolved.rpcData, hit.index, resolved.refName)
            : formatFeatureTooltip(hit.id, id => model.getFeatureInfoById(id)),
          hoverCoverageBand,
          highlightedChainIds: hoveredChainIds(hit, resolved),
        })
        return
      }
      case 'none':
        model.clearMouseoverState()
        return
    }
  }

  function handleClick(e: React.MouseEvent) {
    // click fires after mousedown+mouseup regardless of motion in between.
    if (dragMovedRef.current) {
      dragMovedRef.current = false
      return
    }
    const { result } = hitTestEvent(e)

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
        openModificationWidget(
          model,
          result.hit,
          result.resolved.refName,
          snpBaseFromCigar(result.cigarHit),
        )
        return
      case 'feature': {
        const { hit, resolved } = result
        void model.selectFeatureById(hit.id)
        if (model.isChainMode) {
          model.setSelectedChainIds(
            model.chainIdsForRead(resolved.rpcData, hit.index),
          )
        }
        return
      }
      case 'none':
        model.clearSelection()
        return
    }
  }

  return {
    width,
    contrastMap,
    handleMouseDown,
    handleMouseLeave,
    handleContextMenu,
    handleCanvasMouseMove,
    handleClick,
  }
}
