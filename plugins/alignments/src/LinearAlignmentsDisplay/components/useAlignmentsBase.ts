import { useEffect, useMemo, useRef } from 'react'

import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { clamp, getContainingView } from '@jbrowse/core/util'
import { isAlive } from '@jbrowse/mobx-state-tree'

import { snpBaseFromCigar } from '../../shared/hitTestTypes.ts'
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

import type { ResolvedBlock } from '../../shared/hitTestTypes.ts'
import type { LinearAlignmentsDisplayModel } from '../model.ts'
import type { HitTestResult } from './hitTestPipeline.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type React from 'react'

export type { LinearAlignmentsDisplayModel }

export interface FeatureHit {
  id: string
  index: number
}

// Hit-test handlers + palette plumbing for the pileup canvas. Mouse coords come
// straight off the native event (`offsetX`/`offsetY`, canvas-relative since the
// canvas is a borderless leaf element), so no canvas ref or rect math is needed.
export function useAlignmentsBase(model: LinearAlignmentsDisplayModel) {
  const view = getContainingView(model) as LinearGenomeViewModel
  // trackWidthPx, matching renderState.canvasWidth — the CSS width of the canvas
  // element and the width its backing store is sized to must agree, or the whole
  // pileup draws at the wrong horizontal scale.
  const width = view.initialized ? view.trackWidthPx : undefined

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
            showMismatches: model.showMismatches,
            pileupVisible: picked.section.pileupHeight > 0,
          })
        : { type: 'none' }
    return { resolved, picked, result }
  }

  function resolveSectionForCanvasY(canvasY: number) {
    // The model's own scroll projection inputs, not a second hand-assembled
    // copy of them — the overlays all read `scrollModel`, and a hit test that
    // re-spelled the same fields is exactly how the two tiers drift apart.
    return findSectionAtY(model.renderSections, canvasY, {
      ...model.scrollModel,
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
    // drop a hover queued for the next frame, or it would land after the cursor
    // has already gone and re-light the tooltip we are clearing here
    if (hoverRafRef.current !== undefined) {
      cancelAnimationFrame(hoverRafRef.current)
      hoverRafRef.current = undefined
    }
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
      // The genomic column under the cursor, anchoring the "sort at the clicked
      // position" items — the read menu's, and the cigar submenu's base-pair
      // sort. Independent of whether a cigar feature was hit, and the same
      // transform the hit-test pipeline uses.
      const genomicPos = resolved
        ? canvasXToBasePos(e.nativeEvent.offsetX, resolved)
        : undefined
      // One atomic call: coord + block + hits, the hover handoff, plus the async
      // read fetch when the hit carries one. A repositioned menu can't inherit
      // the prior read.
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

  // Hover, resolved at most once per frame.
  //
  // The pileup hit test is not cheap — it walks the render sections, resolves a
  // block, then runs the full `performHitTest` pipeline — and `mousemove`
  // arrives far faster than a frame on any modern pointer. Running it per raw
  // event measured 3.3ms of listener time per event on a 150px pileup, so five
  // events into a frame the frame is already gone; it was comfortably the most
  // expensive hover of any display.
  //
  // Coalescing is safe precisely because nothing *decides* anything from the
  // hover: click and context-menu re-hit-test from their own event (see
  // handleClick, and the note on the two handlers below), which was already the
  // rule so that a hover recorded a frame ago can't act. A hover that lands one
  // frame later than the cursor is, by construction, invisible.
  const hoverRafRef = useRef<ReturnType<typeof requestAnimationFrame>>(undefined)
  const hoverPosRef = useRef<[number, number]>(undefined)

  // A queued hover must not outlive the component: the display is detached from
  // the MST tree before React unmounts it (see AlignmentsDisplayComponent), so
  // a frame landing in between would write hover state onto a dead node.
  useEffect(
    () => () => {
      if (hoverRafRef.current !== undefined) {
        cancelAnimationFrame(hoverRafRef.current)
      }
    },
    [],
  )

  function handleCanvasMouseMove(e: React.MouseEvent) {
    if (isDragInProgress(dragControllerRef)) {
      return
    }
    // read off the event now; it is pooled-adjacent and gone by the next frame
    hoverPosRef.current = [e.nativeEvent.offsetX, e.nativeEvent.offsetY]
    if (hoverRafRef.current === undefined) {
      hoverRafRef.current = requestAnimationFrame(() => {
        hoverRafRef.current = undefined
        const pos = hoverPosRef.current
        // re-check the drag: one queued before the press would otherwise land
        // mid-pan, which is the case the event-time guard alone can't see
        if (pos && isAlive(model) && !isDragInProgress(dragControllerRef)) {
          resolveHoverAt(pos[0], pos[1])
        }
      })
    }
  }

  function resolveHoverAt(canvasX: number, canvasY: number) {
    const { result, picked } = runHitTest(canvasX, canvasY)

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
