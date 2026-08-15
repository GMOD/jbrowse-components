import type { ResolvedPanel } from './resolvePanel.ts'

// The anchor is a row like any other so it can be dragged through the stack.
// It carries no panel of its own and cannot be unchecked: it is the assembly the
// region was selected on, and every mate's coordinates were resolved against it.
export interface AnchorPanelRow {
  kind: 'anchor'
  assemblyName: string
}

// Where this row's panel will open, resolved once in the worker rather than by
// the component that shows it. Nothing it depends on changes while the list is
// on screen: the region is fixed, and reordering or unchecking a row moves the
// panel rather than moving where it opens.
export interface MatePanelRow extends ResolvedPanel {
  kind: 'mate'
  checked: boolean
}

export type PanelRow = AnchorPanelRow | MatePanelRow

export function toPanelRows(
  anchorAssembly: string,
  panels: ResolvedPanel[],
): PanelRow[] {
  return [
    { kind: 'anchor', assemblyName: anchorAssembly },
    ...panels.map(panel => ({
      ...panel,
      kind: 'mate' as const,
      checked: true,
    })),
  ]
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
  return rows.map((row, i) =>
    i === index && row.kind === 'mate' ? { ...row, checked } : row,
  )
}

export function setAllPanelsChecked(rows: PanelRow[], checked: boolean) {
  return rows.map(row => (row.kind === 'mate' ? { ...row, checked } : row))
}

// The stack the launch will build: the checked mates in list order, plus where
// the anchor sits among them. A three-panel launch off a reference-anchored
// dataset (an MCScan blocks table) wants the anchor in the middle, where both
// bands are direct pairs — with it on top, the second band is mate-to-mate.
export function launchOrder(rows: PanelRow[]) {
  const kept = rows.filter(row => row.kind === 'anchor' || row.checked)
  return {
    anchorIndex: kept.findIndex(row => row.kind === 'anchor'),
    mates: kept.filter(row => row.kind === 'mate'),
  }
}
