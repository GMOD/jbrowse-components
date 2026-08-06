import { treeSidebarRightEdge } from '@jbrowse/tree-sidebar'

import {
  findFeatureAtBp,
  findSourceHit,
  hitTestMouse,
  makeTooltipRow,
} from '../../shared/wiggleComponentUtils.ts'

import type { MouseRegion } from '../../shared/wiggleComponentUtils.ts'
import type {
  WiggleDataResult,
  WiggleFeatureUnderMouse,
  WiggleTooltipRow,
} from '../../util.ts'

interface VisibleSource {
  name: string
  color?: string
}

// Overlay mode: every visible source's score at the cursor bp becomes a row.
// The header coord is the cursor bp itself — picking one source's feature
// interval would be arbitrary across sources with different bin widths. Rows
// follow visibleSources order (the on-screen legend order).
//
// That single base is reported as the interval `[bp, bp + 1)`, like every other
// coordinate pair in the codebase, rather than as a zero-width `[bp, bp]`: the
// tooltip and the feature widget both read these as a half-open interval, so a
// collapsed one printed a backwards range and opened a zero-length feature.
export function findOverlayHit(
  data: WiggleDataResult,
  visibleSources: VisibleSource[],
  bp: number,
  refName: string,
  summaryScoreMode: string,
): WiggleFeatureUnderMouse | undefined {
  const dataByName = new Map(data.sources.map(s => [s.name, s]))
  const rows: WiggleTooltipRow[] = []
  for (const src of visibleSources) {
    const ds = dataByName.get(src.name)
    if (ds) {
      const i = findFeatureAtBp(ds.featurePositions, ds.numFeatures, bp)
      if (i !== -1) {
        rows.push(makeTooltipRow(ds, i, summaryScoreMode, src.name, src.color))
      }
    }
  }
  return rows.length === 0
    ? undefined
    : { refName, start: bp, end: bp + 1, rows }
}

// Row mode: cursor Y picks one row → one source. Returns its feature interval.
// A non-positive rowHeight (zero-height display) would make the division yield
// NaN/Infinity, so it's rejected up front rather than leaning on an
// out-of-bounds index coming back undefined.
export function findRowHit(
  data: WiggleDataResult,
  visibleSources: VisibleSource[],
  bp: number,
  offsetY: number,
  rowHeight: number,
  refName: string,
  summaryScoreMode: string,
): WiggleFeatureUnderMouse | undefined {
  if (rowHeight <= 0) {
    return undefined
  }
  const src = visibleSources[Math.floor(offsetY / rowHeight)]
  const ds = src ? data.sources.find(s => s.name === src.name) : undefined
  return src && ds
    ? findSourceHit(ds, bp, refName, summaryScoreMode, src.name, src.color)
    : undefined
}

// What findMultiWiggleHit reads off the display model — spelled out rather than
// taking the full model so the hit logic stays unit-testable without MST.
export interface MultiWiggleHitModel {
  effectiveRowHeight: number
  sources: VisibleSource[]
  rpcDataMap: ReadonlyMap<number, WiggleDataResult>
  // the resolved mode, never the raw `summaryScoreMode` slot: density draws
  // averages whatever the slot says, and the tooltip has to report what the
  // plot (and the track menu's radio) actually shows
  effectiveSummaryScoreMode: string
  isOverlay: boolean
  showTree: boolean
  hierarchy?: unknown
  treeAreaWidth: number
}

// The feature under the cursor, or undefined when the cursor isn't over plotted
// data. Single entry point for multi-wiggle hit-testing: hover, the vertical
// guide, and click-to-select all derive from this one answer, so they can't
// disagree about what the cursor is over.
//
// The tree sidebar and its resize handle overlay the left of the same container
// the mouse handlers are bound to and don't stop propagation, so cursor
// positions over them are excluded here. Doing it at the hit (rather than hiding
// the tooltip downstream) is what keeps a click on a tree node from also opening
// a feature widget behind the node menu.
// Where a right-click landed: which loaded region, and the base under the
// cursor. Deliberately not the hovered feature — in row mode that resolves the
// one source the cursor is over, and the row-order sort needs every source's
// score at the same column, which it reads back out of the region's data.
export interface MultiWiggleContextHit {
  displayedRegionIndex: number
  bp: number
}

// The genomic column a right-click names, or undefined when the click wasn't
// over loaded data. Same tree-sidebar exclusion as findMultiWiggleHit: the
// sidebar overlays the left of this container and owns its own node menu.
export function findMultiWiggleContextHit(
  model: MultiWiggleHitModel,
  regions: MouseRegion[],
  offsetX: number,
): MultiWiggleContextHit | undefined {
  if (offsetX < treeSidebarRightEdge(model)) {
    return undefined
  }
  const hit = hitTestMouse(regions, model.rpcDataMap, offsetX)
  return hit
    ? { displayedRegionIndex: hit.region.displayedRegionIndex, bp: hit.bp }
    : undefined
}

export function findMultiWiggleHit(
  model: MultiWiggleHitModel,
  regions: MouseRegion[],
  offsetX: number,
  offsetY: number,
): WiggleFeatureUnderMouse | undefined {
  const {
    effectiveRowHeight,
    sources,
    rpcDataMap,
    effectiveSummaryScoreMode,
    isOverlay,
  } = model
  if (sources.length === 0 || offsetX < treeSidebarRightEdge(model)) {
    return undefined
  }
  const hit = hitTestMouse(regions, rpcDataMap, offsetX)
  if (!hit) {
    return undefined
  }
  const { data, bp, region } = hit
  return isOverlay
    ? findOverlayHit(
        data,
        sources,
        bp,
        region.refName,
        effectiveSummaryScoreMode,
      )
    : findRowHit(
        data,
        sources,
        bp,
        offsetY,
        effectiveRowHeight,
        region.refName,
        effectiveSummaryScoreMode,
      )
}
