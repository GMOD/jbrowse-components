import { useEffect, useMemo, useRef } from 'react'

import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { clamp, getContainingView } from '@jbrowse/core/util'
import { isAlive } from '@jbrowse/mobx-state-tree'

import {
  arcColorLegendCategory,
  isFlatArcShape,
} from '../../features/arcs/compute.ts'
import { snpBaseFromCigar } from '../../shared/hitTestTypes.ts'
import { readColorCategoryLabel } from '../../shared/legendUtils.ts'
import { getMismatchContrastMap } from '../../shared/util.ts'
import {
  CLICK_SUPPRESS_THRESHOLD_PX,
  isDragInProgress,
  startDocumentDrag,
  useAbortableRef,
} from './alignmentComponentUtils.ts'
import { resolveArcBandHover } from './arcHitTest.ts'
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
  formatArcLineTooltip,
  formatArcTooltip,
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

  // The visible region the cursor is over. Regions don't overlap in screen x, so
  // at most one matches. Split out because the arc band needs the region itself —
  // its `displayedRegionIndex` keys the per-region arc feed, and its bp/px edges
  // are the projection — while the pileup path only wants the block.
  function visibleRegionAt(canvasX: number) {
    return view.initialized
      ? view.visibleRegions.find(
          r => canvasX >= r.screenStartPx && canvasX < r.screenEndPx,
        )
      : undefined
  }

  function resolveBlockForCanvasX(
    canvasX: number,
    dataMap: { get(idx: number): ResolvedBlock['rpcData'] | undefined },
  ): ResolvedBlock | undefined {
    const r = visibleRegionAt(canvasX)
    const data = r ? dataMap.get(r.displayedRegionIndex) : undefined
    return r && data
      ? {
          rpcData: data,
          bpRange: [r.start, r.end],
          blockStartPx: r.screenStartPx,
          blockWidth: r.screenEndPx - r.screenStartPx,
          refName: r.refName,
          reversed: r.reversed ?? false,
        }
      : undefined
  }

  // What the cursor is on in the hovered section's arc band, as the two fields
  // `setHoverState` takes for it: the tooltip to show and the ink to mark it
  // with. Both come from one `resolveArcBandHover`, so the mark is on the arc
  // the tooltip describes by construction rather than by agreement.
  //
  // Kept OUT of `performHitTest`: that pipeline is the pileup's, and takes a
  // resolved block of laid-out reads. Arcs are a different feed (per group, per
  // region, straight off `arcsByGroup`), drawn into a band of their own, and a
  // lane can have arcs with no drawn pileup at all — read-cloud mode is exactly
  // that. Threading them through the block pipeline would have made the block
  // the gate on a hover that does not depend on one.
  function resolveArcHover(
    canvasX: number,
    canvasY: number,
    section: {
      groupKey: string
      arcBandTop: number
      arcBandHeight: number
      arcDown: boolean
    },
  ) {
    const region = visibleRegionAt(canvasX)
    if (!region || model.readConnections === 'off') {
      return undefined
    }
    const arcs = model.arcsByGroup
      .get(section.groupKey)
      ?.get(region.displayedRegionIndex)
    const hover = resolveArcBandHover(canvasX, canvasY, arcs, {
      region,
      band: section,
      scroll: model.scrollModel,
      lineWidth: model.readConnectionsLineWidth,
      arcsYDomainBp: model.arcsYDomainBp,
      canvasWidthPx: view.trackWidthPx,
    })
    if (!hover) {
      return undefined
    }
    const { hit, highlight } = hover
    return {
      // A tick reports what it points AT; an arc reports its span and colour
      // bucket. The two payloads are disjoint (see `ArcLineTooltipPayload`), so
      // the discriminant the hit already carries picks the formatter rather
      // than one formatter taking half-meaningless arguments.
      tooltip:
        hit.kind === 'tick'
          ? formatArcLineTooltip(hit, region.refName)
          : formatArcTooltip(
              hit,
              region.refName,
              readColorCategoryLabel(
                arcColorLegendCategory(hit.colorType, model.arcColorByType),
              ),
              isFlatArcShape(hit.shapeType),
            ),
      highlight,
    }
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

  // The reads of the chain a hovered read belongs to, for the chain highlight.
  // Empty outside chain mode, and empty for a cigar/modification hit that
  // resolved no read.
  // Keeping it keyed off the read (rather than only the bare-body branch) is what
  // stops the previous read's highlight going stale while the cursor sits on a
  // mismatch or modified base.
  function hoveredChainReadIds(
    featureHit: FeatureHit | undefined,
    resolved: ResolvedBlock,
  ) {
    return model.isChainMode && featureHit
      ? model.readIdsSharingChain(resolved.rpcData, featureHit.index)
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
  const hoverRafRef =
    useRef<ReturnType<typeof requestAnimationFrame>>(undefined)
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

    // Arcs are painted AFTER coverage by both backends (see the pass order in
    // drawAlignmentBlocks), so in up mode an arc is the ink on top of the
    // histogram it overlays — and the ink under the cursor is what a hover
    // should name. Safe to put first because this is a stroke test, not a band
    // test: it only answers within a few px of a curve, so the rest of the
    // coverage band still reaches `hitTestCoverage` below untouched.
    const arc = picked
      ? resolveArcHover(canvasX, canvasY, picked.section)
      : undefined
    if (arc) {
      model.setHoverState({
        // FALSE, unlike every other tooltip branch here: `overCigarItem` is the
        // pointer cursor, and the pointer is a promise that clicking does
        // something. An arc carries no read id — the feed is junctions, not
        // features — so there is nothing to select or open, and `handleClick`
        // deliberately swallows the click rather than acting on whatever is
        // under the arc. A tooltip and a highlight with a default cursor is the
        // honest picture of a mark that is informational only.
        overCigarItem: false,
        featureIdUnderMouse: undefined,
        mouseoverExtraInformation: arc.tooltip,
        hoveredArcHighlight: arc.highlight,
        hoverCoverageBand,
        highlightedChainReadIds: [],
      })
      return
    }

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
          highlightedChainReadIds: [],
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
          highlightedChainReadIds: hoveredChainReadIds(
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
          highlightedChainReadIds: hoveredChainReadIds(
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
          highlightedChainReadIds: hoveredChainReadIds(hit, resolved),
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
    const { offsetX, offsetY } = e.nativeEvent
    const { result, picked } = hitTestEvent(e)

    // The click has to agree with the hover, and the hover resolves an arc
    // AHEAD of the band it is painted over (see `resolveHoverAt`). An arc has
    // nothing to open, so this is a no-op — but it has to be an explicit one:
    // falling through named whatever the arc happens to overlay. In down mode
    // that is nothing, and `case 'none'` CLEARED THE SELECTION, so clicking the
    // arc you were hovering threw away the read you had selected. In up mode the
    // arc band IS the coverage band (`computeArcBand` gives it top 0), so the
    // click opened the coverage bin widget for the column while the tooltip
    // said "Read connection".
    if (picked && resolveArcHover(offsetX, offsetY, picked.section)) {
      return
    }

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
          model.setSelectedChainReadIds(
            model.readIdsSharingChain(resolved.rpcData, hit.index),
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
