import { rowIndexAt } from '@jbrowse/core/util/rowStackGeometry'
import { treeSidebarRightEdge } from '@jbrowse/tree-sidebar'

import {
  findFeatureAtBp,
  findSourceHit,
  hitTestMouse,
  makeTooltipRow,
} from '../../shared/wiggleHitTest.ts'

import type { MouseRegion } from '../../shared/wiggleHitTest.ts'
import type { WiggleHoveredFeature, WiggleTooltipRow } from '../../util.ts'
import type { WiggleDataResult } from '@jbrowse/wiggle-core'

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
): WiggleHoveredFeature | undefined {
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
//
// `getRowHeight` is `canvasHeight / numRows` with no floor, so a cohort-sized
// track really does go sub-pixel (400 px over 1000 sources is 0.4 px a row).
// These rows are sized to fit the display, so there is no scroll offset.
export function findRowHit(
  data: WiggleDataResult,
  visibleSources: VisibleSource[],
  bp: number,
  offsetY: number,
  rowHeight: number,
  refName: string,
  summaryScoreMode: string,
): WiggleHoveredFeature | undefined {
  if (rowHeight <= 0) {
    return undefined
  }
  const rowIndex = rowIndexAt(offsetY, { rowHeight })
  const src = visibleSources[rowIndex]
  const ds = src ? data.sources.find(s => s.name === src.name) : undefined
  return src && ds
    ? findSourceHit(ds, bp, refName, summaryScoreMode, src.name, src.color)
    : undefined
}

// What the hit functions below read off the display model — spelled out rather
// than taking the full model so the hit logic stays unit-testable without MST.
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
export function findMultiWiggleHit(
  model: MultiWiggleHitModel,
  regions: MouseRegion[],
  offsetX: number,
  offsetY: number,
): WiggleHoveredFeature | undefined {
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

// Where a right-click landed, as a genomic coordinate rather than as which
// loaded region it fell in: that is what the sort takes, so the same position
// works from the menu and from a session's `sortRowsBy`, and it stays meaningful
// after the fetch that produced the region is gone.
//
// Deliberately not the hovered feature — in row mode that names the one source
// the cursor is over, and the row-order sort ranks every source at the same
// column, which it reads back out of the region's data.
export interface MultiWiggleContextHit {
  refName: string
  bp: number
}

// What the right-click carries into the menu: the column the sort ranks at,
// plus the hit under the same pointer for the two items that are about one
// record rather than about the row order. Undefined in the gaps — an overlay
// column no source has a bin in, a row whose file doesn't cover this contig.
export interface MultiWiggleContextInfo extends MultiWiggleContextHit {
  feature?: WiggleHoveredFeature
}

// The genomic column a right-click names, or undefined when the click wasn't
// over loaded data. Excludes the tree sidebar for the same reason
// findMultiWiggleHit does. It resolves a column rather than a feature, so it
// takes only the data map and the sidebar geometry — the row and score fields
// of the hit model have no part in it.
export function findMultiWiggleContextHit(
  model: Pick<
    MultiWiggleHitModel,
    'rpcDataMap' | 'showTree' | 'hierarchy' | 'treeAreaWidth'
  >,
  regions: MouseRegion[],
  offsetX: number,
): MultiWiggleContextHit | undefined {
  if (offsetX < treeSidebarRightEdge(model)) {
    return undefined
  }
  const hit = hitTestMouse(regions, model.rpcDataMap, offsetX)
  return hit ? { refName: hit.region.refName, bp: hit.bp } : undefined
}
