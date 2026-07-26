import type { MateCandidate } from './pickMatesForRegion.ts'

export interface PanelRow extends MateCandidate {
  checked: boolean
}

export function toPanelRows(candidates: MateCandidate[]): PanelRow[] {
  return candidates.map(candidate => ({ ...candidate, checked: true }))
}

// Move one row by one position. Order is not cosmetic here: a LinearSyntenyView
// draws a ribbon band between *adjacent* panels only, so which comparisons
// exist at all is decided by this list. Unchecked rows are carried along rather
// than skipped, so unchecking and re-checking a panel puts it back where it was.
export function movePanel(rows: PanelRow[], index: number, delta: number) {
  const to = index + delta
  if (to < 0 || to >= rows.length) {
    return rows
  }
  const next = [...rows]
  const [moved] = next.splice(index, 1)
  next.splice(to, 0, moved!)
  return next
}

export function setPanelChecked(
  rows: PanelRow[],
  index: number,
  checked: boolean,
) {
  return rows.map((row, i) => (i === index ? { ...row, checked } : row))
}

export function checkedPanels(rows: PanelRow[]) {
  return rows.filter(row => row.checked)
}
