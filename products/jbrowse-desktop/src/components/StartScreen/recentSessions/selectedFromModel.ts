import type { RecentSessionData } from '../types.ts'
import type { GridRowSelectionModel } from '@mui/x-data-grid'

// The v9 selection model is either an explicit include-set or an exclude-set
// (the header "select all" checkbox produces the latter, e.g. {type:'exclude',
// ids:{}} meaning "everything is selected"). A bare ids.has() check silently
// inverts the exclude case, so select-all would report zero rows selected.
export function selectedFromModel(
  model: GridRowSelectionModel,
  sessions: RecentSessionData[],
) {
  return model.type === 'exclude'
    ? sessions.filter(s => !model.ids.has(s.path))
    : sessions.filter(s => model.ids.has(s.path))
}
