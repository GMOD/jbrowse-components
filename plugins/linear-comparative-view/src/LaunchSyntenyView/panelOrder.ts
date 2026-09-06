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

// Two mates put the anchor BETWEEN them. A band is drawn between adjacent
// panels only, and a reference-anchored dataset — an MCScan blocks table, a
// star of pairwise alignments — states each mate against the anchor and
// nothing between two mates, so with the anchor on top the second band was
// blank. One mate is a pair either way; three or more lead with the anchor,
// and the dialog says which bands that leaves empty or repeats it.
export function toPanelRows(
  anchorAssembly: string,
  panels: ResolvedPanel[],
): PanelRow[] {
  const anchor: PanelRow = { kind: 'anchor', assemblyName: anchorAssembly }
  const mates = panels.map(panel => ({
    ...panel,
    kind: 'mate' as const,
    checked: true,
  }))
  return mates.length === 2
    ? [mates[0]!, anchor, mates[1]!]
    : [anchor, ...mates]
}

// The adjacent pairs of the launched stack that put two mates together, with
// no anchor on either side — the bands a dataset that only states each mate
// against the anchor cannot draw.
export function mateOnlyLevels(rows: PanelRow[]) {
  const kept = rows.filter(row => row.kind === 'anchor' || row.checked)
  const levels: [string, string][] = []
  for (let i = 0; i + 1 < kept.length; i++) {
    const upper = kept[i]!
    const lower = kept[i + 1]!
    if (upper.kind === 'mate' && lower.kind === 'mate') {
      levels.push([upper.assemblyName, lower.assemblyName])
    }
  }
  return levels
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
