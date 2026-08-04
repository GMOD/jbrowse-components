import { resolveSelectedIds } from '@jbrowse/core/util'

import type { GridRowSelectionModel } from '@mui/x-data-grid'

// Map a v9 selection model to the selected session rows. resolveSelectedIds
// handles the include/exclude distinction (the header "select all" produces an
// exclude-set) that a bare model.ids read would get wrong.
//
// Generic in the row rather than taking RecentSessionData: the path is the row
// id and the only field this reads, so the caller gets its own row type back
// and a test needs nothing else on a fixture row.
export function selectedFromModel<T extends { path: string }>(
  model: GridRowSelectionModel,
  sessions: T[],
) {
  const ids = resolveSelectedIds(
    model,
    sessions.map(s => s.path),
  )
  return sessions.filter(s => ids.has(s.path))
}
