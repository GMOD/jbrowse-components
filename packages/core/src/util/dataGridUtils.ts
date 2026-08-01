import { coarseStripHTML } from './coarseStripHTML.ts'
import { getStr } from './getStr.ts'
import { measureText } from './measureText.ts'
import { max } from './numericUtils.ts'

import type { GridRowId, GridRowSelectionModel } from '@mui/x-data-grid'

// The @mui/x-data-grid helpers, kept out of the `util` barrel: they are the
// barrel's only reason to reach @mui/x-data-grid, and the barrel is imported by
// worker-side adapter code that renders no grid.

// heuristic measurement for a column of a @mui/x-data-grid, pass in
// values from a column
export function measureGridWidth(
  elements: unknown[],
  args?: {
    minWidth?: number
    fontSize?: number
    maxWidth?: number
    padding?: number
    stripHTML?: boolean
  },
) {
  const {
    padding = 30,
    minWidth = 80,
    fontSize = 12,
    maxWidth = 1000,
    stripHTML = false,
  } = args ?? {}
  return max(
    elements.map(element => {
      const str = getStr(element)
      const n = measureText(stripHTML ? coarseStripHTML(str) : str, fontSize)
      return Math.min(Math.max(n + padding, minWidth), maxWidth)
    }),
  )
}

// Resolve a @mui/x-data-grid v9 selection model into the concrete set of
// selected row ids. The model is either an explicit include-set or an
// exclude-set (the header "select all" checkbox produces the latter, e.g.
// {type:'exclude', ids:{}} meaning "everything selected"), so reading model.ids
// directly silently drops select-all and inverts a select-all-then-deselect.
export function resolveSelectedIds(
  model: GridRowSelectionModel,
  allIds: Iterable<GridRowId>,
): Set<GridRowId> {
  if (model.type === 'exclude') {
    const result = new Set<GridRowId>()
    for (const id of allIds) {
      if (!model.ids.has(id)) {
        result.add(id)
      }
    }
    return result
  } else {
    return new Set(model.ids)
  }
}
