import { useRef } from 'react'

import { useCoalescedPointer } from '@jbrowse/core/ui/useCoalescedPointer'
import { isAlive } from '@jbrowse/mobx-state-tree'
import { regionAtPixel } from '@jbrowse/render-core/canvas2dUtils'

import { arcColorLegendCategory } from '../../features/arcs/arcColors.ts'
import { snpBaseFromCigar } from '../../shared/hitTestTypes.ts'
import { readColorCategoryLabel } from '../../shared/legendUtils.ts'
import { resolveArcBandHover } from './arcHitTest.ts'
import {
  openCigarWidget,
  openCoverageWidget,
  openIndicatorWidget,
  openModificationWidget,
} from './detailWidgets.ts'
import { findSectionAtY } from './findSectionAtY.ts'
import { contextMenuTargetForHit, performHitTest } from './hitTestPipeline.ts'
import {
  formatArcLineTooltip,
  formatArcTooltip,
  formatCigarTooltip,
  formatCoverageTooltip,
  formatIndicatorTooltip,
  formatModificationTooltip,
  formatReadTooltip,
} from './tooltipUtils.ts'

import type { ArcsUploadData } from '../../features/arcs/types.ts'
import type { ResolvedBlock } from '../../shared/hitTestTypes.ts'
import type { LinearAlignmentsDisplayModel } from '../model.ts'
import type { ArcMarkHit } from './arcHitTest.ts'
import type { MarkHitResult } from './hitTestPipeline.ts'
import type React from 'react'

export type { LinearAlignmentsDisplayModel }

export interface FeatureHit {
  id: string
  index: number
}

// The LGV's click-drag pan (`useSideScroll`) publishes its state as attributes
// on the tracks container: one while the button is down, one once the press
// has travelled far enough to be a pan rather than a click.
const PAN_DRAGGING = '[data-pan-dragging]'
const PAN_MOVED = '[data-pan-moved]'

// Hit-test handlers + palette plumbing for the pileup canvas. Mouse coords come
// straight off the native event (`offsetX`/`offsetY`, canvas-relative since the
// canvas is a borderless leaf element), so no canvas ref or rect math is needed.
export function useAlignmentsBase(model: LinearAlignmentsDisplayModel) {
  const { view } = model
  // `canvasWidthPx`, matching renderState.canvasWidth — the CSS width of the
  // canvas element and the width its backing store is sized to must agree, or
  // the whole pileup draws at the wrong horizontal scale. Off the model, never a
  // second `view.trackWidthPx` read (see
  // `MultiRegionDisplayMixin.canvasWidthPx`); gated on `initialized` because it
  // reaches `view.width`, which throws before the view is measured.
  const width = view.initialized ? model.canvasWidthPx : undefined

  // The canvas the last mousemove came off, for the hover frame to ask whether
  // a pan started under it after the event was queued.
  const hoverTargetRef = useRef<Element | null>(null)
  const isPanning = () => hoverTargetRef.current?.closest(PAN_DRAGGING) != null

  const { mismatchContrastMap: contrastMap } = model

  const {
    featureHeight,
    featureSpacing,
    showInterbaseIndicators,
    isChainMode,
  } = model

  function runHitTest(canvasX: number, canvasY: number) {
    const picked = resolveSectionForCanvasY(canvasY)
    const resolved = picked
      ? resolveBlockForCanvasX(canvasX, picked.section.laidOutPileupMap)
      : undefined
    // The arc band OUTRANKS the pileup, so it answers as the result rather than
    // beside it — one value with one discriminant, which is what makes every
    // gesture's switch state what it does about an arc (see `ArcMarkHit`).
    // Arcs are painted after coverage by both backends, so in up mode an arc is
    // the ink on top of the histogram it overlays, and the ink under the cursor
    // is what a gesture should be about. Safe to let it win because the arc test
    // is a STROKE test, not a band test: it only answers within a few px of a
    // curve, so the rest of the coverage band still reaches `hitTestCoverage`.
    //
    // Asked BEFORE the pileup, because outranking it also means not paying for
    // it: `performHitTest` is the expensive half of this listener and its answer
    // is discarded whenever an arc has one. `resolved` still comes first — the
    // context menu wants the block whatever is under the cursor — but it is a
    // region lookup and a map get, not the pipeline.
    const arc = picked
      ? resolveArcHover(canvasX, canvasY, picked.section)
      : undefined
    // No section under the cursor, or no fetched block at that x, is a miss.
    // Answering it here is what lets performHitTest take a definite block and
    // read the section's real offsets rather than standing in for a missing one.
    const result: MarkHitResult =
      arc ??
      (picked && resolved
        ? performHitTest(canvasX, canvasY, resolved, {
            showInterbaseIndicators,
            // The hovered section's own coverage band (gated to 0 when off),
            // in the section frame `coverageTopOffset` puts the cursor in.
            coverageHeight: picked.section.coverageHeight,
            coverageMaxDepth: model.coverageDomain?.[1],
            coverageSnpMinFrequency: model.coverageSnpMinFrequency,
            topOffset: picked.section.topOffset,
            coverageTopOffset: picked.coverageTopOffset,
            featureHeight,
            featureSpacing,
            scrollTop: model.scrollTop,
            isChainMode,
            filterMismatchesByFrequency: model.filterMismatchesByFrequency,
            showMismatches: model.showMismatches,
            pileupVisible: picked.section.pileupHeight > 0,
            colorScheme: model.colorSchemeIndex,
          })
        : { type: 'none' })
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

  // Split out because the arc band needs the region itself — its
  // `displayedRegionIndex` keys the per-region arc feed, and its bp/px edges are
  // the projection — while the pileup path only wants the block.
  function visibleRegionAt(canvasX: number) {
    return view.initialized
      ? regionAtPixel(view.visibleRegions, canvasX)
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

  // What the cursor is on in the hovered section's arc band, as the `ArcMarkHit`
  // every gesture switches over.
  //
  // Kept OUT of `performHitTest`: that pipeline is the pileup's, and takes a
  // resolved block of laid-out reads. Arcs are a different feed (per lane, per
  // region), drawn into a band of their own, and a lane can have arcs with no
  // drawn pileup at all — read-cloud mode is exactly that. Threading them
  // through the block pipeline would have made the block the gate on a hover
  // that does not depend on one.
  function resolveArcHover(
    canvasX: number,
    canvasY: number,
    section: {
      arcsRpcDataMap: ReadonlyMap<number, ArcsUploadData>
      arcBandTop: number
      arcBandHeight: number
      arcDown: boolean
    },
  ) {
    // The setting first: this now runs ahead of `performHitTest` on every hover
    // frame, so a display with the band off must not pay a region scan for it.
    if (model.readConnections === 'off') {
      return undefined
    }
    const region = visibleRegionAt(canvasX)
    if (!region) {
      return undefined
    }
    const arcs = section.arcsRpcDataMap.get(region.displayedRegionIndex)
    const hover = resolveArcBandHover(canvasX, canvasY, arcs, {
      region,
      band: section,
      scroll: model.scrollModel,
      lineWidth: model.readConnectionsLineWidth,
      arcsYDomainBp: model.arcsYDomainBp,
      canvasWidthPx: model.canvasWidthPx,
    })
    if (!hover) {
      return undefined
    }
    const { hit, highlight } = hover
    const arc: ArcMarkHit = {
      type: 'arc',
      // A tick reports what it points AT; an arc reports its span and colour
      // bucket. The two payloads are disjoint (see `ArcLineTooltipPayload`), so
      // the discriminant the hit already carries picks the formatter rather
      // than one formatter taking half-meaningless arguments.
      tooltip:
        hit.kind === 'tick'
          ? formatArcLineTooltip(
              hit,
              region.refName,
              // Arc mode and only there — see `partnerOffView`. Read off the
              // same setting `resolveArcs` branches on, so the sentence the
              // hover prints and the rule that produced the tick cannot
              // disagree.
              model.readConnections !== 'cloud',
            )
          : formatArcTooltip(
              hit,
              region.refName,
              readColorCategoryLabel(
                arcColorLegendCategory(hit.colorType, model.arcColorByType),
              ),
            ),
      highlight,
    }
    return arc
  }

  // Maps a canvas mouse event to canvas coordinates and runs the full hit-test
  // pipeline. Shared by the context-menu, click, and move handlers so the coord
  // + hit-test preamble lives in one place.
  function hitTestEvent(e: React.MouseEvent) {
    const { offsetX, offsetY } = e.nativeEvent
    return runHitTest(offsetX, offsetY)
  }

  // --- Shared event handlers ---

  function handleMouseLeave() {
    // drop a hover queued for the next frame, or it would land after the cursor
    // has already gone and re-light the tooltip we are clearing here
    hover.cancel()
    if (!model.contextMenuInfo) {
      model.clearMouseoverState()
    }
  }

  function handleContextMenu(e: React.MouseEvent) {
    const { result } = hitTestEvent(e)

    // An arc resolves to no target, so it falls through to the BROWSER's menu
    // rather than calling `preventDefault` — which is what a mark with nothing
    // to offer should do. Before that was true, right-clicking an arc that
    // crossed an indicator column opened the interbase menu for that column
    // while the tooltip said "Read connection": in up mode the arc band IS the
    // coverage band (`computeArcBand` gives it top 0), and `hitTestInterbase`
    // answers over the indicator strip and the bar stack inside it.
    const target = contextMenuTargetForHit(result, e.nativeEvent.offsetX)
    if (target) {
      e.preventDefault()
      // a hover frame queued before the click would otherwise land after the
      // open and undo the pin it takes on the menu's read
      hover.cancel()
      // One atomic call: anchor + the whole resolved hit, the hover handoff,
      // plus the async read fetch when the hit carries one. A repositioned menu
      // can't inherit the prior read.
      model.openContextMenu({
        clientX: e.clientX,
        clientY: e.clientY,
        ...target,
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

  // Hover, resolved at most once per frame — `useCoalescedPointer` owns the
  // frame discipline and the two cancels (leave, unmount); the guards below are
  // this display's own.
  //
  // The pileup hit test is not cheap: it walks the render sections, resolves a
  // block, then runs the full `performHitTest` pipeline, which measured 3.3ms of
  // listener time per raw event on a 150px pileup.
  const hover = useCoalescedPointer(([canvasX, canvasY]: [number, number]) => {
    // re-check the pan: one queued before the press would otherwise land
    // mid-pan, which is the case the event-time guard alone can't see
    if (isAlive(model) && !isPanning()) {
      resolveHoverAt(canvasX, canvasY)
    }
  })

  function handleCanvasMouseMove(e: React.MouseEvent) {
    hoverTargetRef.current = e.currentTarget
    if (isPanning()) {
      return
    }
    // read off the event now; it is pooled-adjacent and gone by the next frame
    hover.queue([e.nativeEvent.offsetX, e.nativeEvent.offsetY])
  }

  // What one hit hovers to, minus the coverage band every branch shares. A
  // function returning the state rather than five `setHoverState` calls: the
  // fields are the same five in every branch, so a branch could differ from its
  // neighbours by forgetting one rather than by deciding anything — which is
  // exactly what happened to `hoverCoverageBand`, left stale by the one branch
  // that did not mention it (the note on `setHoverState` records it).
  type HoverState = Omit<
    Parameters<typeof model.setHoverState>[0],
    'hoverCoverageBand'
  >

  function hoverStateForResult(result: MarkHitResult): HoverState {
    switch (result.type) {
      case 'arc':
        return {
          // FALSE, unlike every other tooltip branch: `overCigarItem` is the
          // pointer cursor, and the pointer is a promise that clicking does
          // something. An arc carries no read id — the feed is junctions, not
          // features — so there is nothing to select or open, and `handleClick`
          // deliberately swallows the click rather than acting on whatever is
          // under the arc.
          overCigarItem: false,
          featureIdUnderMouse: undefined,
          mouseoverExtraInformation: result.tooltip,
          hoveredArcHighlight: result.highlight,
          highlightedChainReadIds: [],
        }
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
        return {
          overCigarItem: tooltip !== undefined,
          featureIdUnderMouse: undefined,
          mouseoverExtraInformation: tooltip,
          highlightedChainReadIds: [],
        }
      }
      case 'modification':
        return {
          overCigarItem: true,
          featureIdUnderMouse: result.featureHit?.id,
          mouseoverExtraInformation: formatModificationTooltip(
            result.hit,
            result.resolved.refName,
            snpBaseFromCigar(result.cigarHit),
          ),
          highlightedChainReadIds: hoveredChainReadIds(
            result.featureHit,
            result.resolved,
          ),
        }
      case 'cigar':
        return {
          overCigarItem: true,
          featureIdUnderMouse: result.featureHit?.id,
          mouseoverExtraInformation: formatCigarTooltip(result.hit),
          highlightedChainReadIds: hoveredChainReadIds(
            result.featureHit,
            result.resolved,
          ),
        }
      case 'feature': {
        const { hit, resolved } = result
        return {
          overCigarItem: false,
          featureIdUnderMouse: hit.id,
          mouseoverExtraInformation: formatReadTooltip(
            resolved.rpcData,
            hit.index,
            resolved.refName,
            model.readCategoryLabel,
          ),
          highlightedChainReadIds: hoveredChainReadIds(hit, resolved),
        }
      }
      case 'none':
        // The same five fields `clearMouseoverState` writes, which is what a
        // miss has always meant here.
        return {
          overCigarItem: false,
          featureIdUnderMouse: undefined,
          mouseoverExtraInformation: undefined,
          highlightedChainReadIds: [],
        }
    }
  }

  function resolveHoverAt(canvasX: number, canvasY: number) {
    const { result, picked } = runHitTest(canvasX, canvasY)

    model.setHoverState({
      ...hoverStateForResult(result),
      // Screen-px coverage band of the hovered section, so the tooltip's
      // vertical bar lands on the hovered group's coverage band rather than
      // always the top one. Written once, for every branch at once.
      hoverCoverageBand: picked
        ? {
            topOffset: picked.coverageTopOffset,
            coverageHeight: picked.section.coverageHeight,
          }
        : undefined,
    })
  }

  function handleClick(e: React.MouseEvent) {
    // click fires after mousedown+mouseup regardless of motion in between
    if (e.currentTarget.closest(PAN_MOVED)) {
      return
    }
    const { result } = hitTestEvent(e)

    switch (result.type) {
      // An arc has nothing to open, so this is a no-op — but an EXPLICIT one:
      // falling through to the pileup's answer named whatever the arc happens
      // to overlay. In down mode that is nothing, and `case 'none'` CLEARS THE
      // SELECTION, so clicking the arc you were hovering threw away the read
      // you had selected. In up mode the arc band IS the coverage band
      // (`computeArcBand` gives it top 0), so the click opened the coverage bin
      // widget for the column while the tooltip said "Read connection".
      case 'arc':
        return
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
      case 'feature':
        model.selectReadWithChain(result.hit.id)
        return
      case 'none':
        model.clearSelection()
        return
    }
  }

  return {
    width,
    contrastMap,
    handleMouseLeave,
    handleContextMenu,
    handleCanvasMouseMove,
    handleClick,
  }
}
