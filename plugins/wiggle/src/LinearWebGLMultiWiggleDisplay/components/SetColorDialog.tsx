import SourcesGrid from './SourcesGrid.tsx'
import SharedSetColorDialog from './ui/SetColorDialog.tsx'

import type { Source } from '../../util.ts'

export default function SetColorDialog({
  model,
  handleClose,
}: {
  model: {
    sources?: Source[]
    setLayout: (s: Source[]) => void
    clearLayout: () => void
  }
  handleClose: () => void
}) {
  return (
    <SharedSetColorDialog
      model={model}
      handleClose={handleClose}
      title="Multi-wiggle color/arrangement editor"
      enableBulkEdit
      enableRowPalettizer
      showTipsStorageKey="multiwiggle-showTips"
      SourcesGridComponent={SourcesGrid}
    />
  )
}
