import SharedSetColorDialog from './setColorDialog/SharedSetColorDialog.tsx'
import SourcesGrid from './setColorDialog/SourcesGrid.tsx'

import type { Source } from './setColorDialog/types.ts'

// Narrow per-row shape we actually pass in/out. The dialog's Source type
// carries an open index signature for bulk-edit CSV fields, but synteny
// layout entries only ever have name/color/label — adapt at the boundary so
// the model doesn't have to expose an index signature on SyntenySource.
interface SyntenyDialogRow {
  name: string
  color?: string
  label?: string
}

export default function SetColorsDialog({
  model,
  handleClose,
}: {
  model: {
    sources: SyntenyDialogRow[]
    setLayout: (s: SyntenyDialogRow[]) => void
    clearLayout: () => void
  }
  handleClose: () => void
}) {
  const adaptedModel = {
    sources: model.sources as Source[],
    setLayout: (s: Source[]) => {
      model.setLayout(s)
    },
    clearLayout: () => {
      model.clearLayout()
    },
  }
  return (
    <SharedSetColorDialog
      model={adaptedModel}
      handleClose={handleClose}
      title="Synteny row colors/arrangement"
      enableBulkEdit
      showTipsStorageKey="multiSyntenyColorDialog-showTips"
      SourcesGridComponent={SourcesGrid}
    />
  )
}
