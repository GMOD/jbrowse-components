import { resolveSelectedIds } from '@jbrowse/core/util'

import type { RecentSessionData } from '../types.ts'
import type { GridRowSelectionModel } from '@mui/x-data-grid'

// Map a v9 selection model to the selected session rows. resolveSelectedIds
// handles the include/exclude distinction (the header "select all" produces an
// exclude-set) that a bare model.ids read would get wrong.
export function selectedFromModel(
  model: GridRowSelectionModel,
  sessions: RecentSessionData[],
) {
  const ids = resolveSelectedIds(
    model,
    sessions.map(s => s.path),
  )
  return sessions.filter(s => ids.has(s.path))
}
