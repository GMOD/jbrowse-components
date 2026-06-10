import { SetColorDialog } from '@jbrowse/tree-sidebar'

import type { MafSource } from '../stateModel.ts'

// MAF rows render no per-sample color (cells are colored by base), so the
// color column is reserved out — this is a reorder + relabel grid. Reordering
// clears the guide tree (rows would no longer line up with the dendrogram); the
// shared dialog warns about that when `hasClusterTree` is set.
const RESERVED = new Set(['color'])
const NO_COLOR_COLUMNS: never[] = []

export default function SetRowArrangementDialog({
  model,
  handleClose,
}: {
  model: {
    editableSources?: MafSource[]
    clusterTree?: string
    setLayout: (s: MafSource[]) => void
    clearLayout: () => void
  }
  handleClose: () => void
}) {
  return (
    <SetColorDialog
      getSources={() => model.editableSources ?? []}
      onSetLayout={s => {
        model.setLayout(s)
      }}
      onClearLayout={() => {
        model.clearLayout()
      }}
      handleClose={handleClose}
      title="MAF display — row arrangement"
      hasClusterTree={!!model.clusterTree}
      colorColumns={NO_COLOR_COLUMNS}
      reservedFields={RESERVED}
    />
  )
}
