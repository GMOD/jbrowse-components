import {
  findFeatureAtBp,
  findSourceHit,
  makeTooltipRow,
} from '../../shared/wiggleComponentUtils.ts'

import type {
  WiggleDataResult,
  WiggleFeatureUnderMouse,
  WiggleTooltipRow,
} from '../../util.ts'

interface VisibleSource { name: string; color?: string }

// Overlay mode: every visible source's score at the cursor bp becomes a row.
// The header coord is the cursor bp itself — picking one source's feature
// interval would be arbitrary across sources with different bin widths. Rows
// follow visibleSources order (the on-screen legend order).
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
  return rows.length === 0 ? undefined : { refName, start: bp, end: bp, rows }
}

// Row mode: cursor Y picks one row → one source. Returns its feature interval.
export function findRowHit(
  data: WiggleDataResult,
  visibleSources: VisibleSource[],
  bp: number,
  offsetY: number,
  rowHeight: number,
  refName: string,
  summaryScoreMode: string,
): WiggleFeatureUnderMouse | undefined {
  const src = visibleSources[Math.floor(offsetY / rowHeight)]
  const ds = src ? data.sources.find(s => s.name === src.name) : undefined
  return src && ds
    ? findSourceHit(ds, bp, refName, summaryScoreMode, src.name, src.color)
    : undefined
}
