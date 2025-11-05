import SharedSetColorDialog from '@jbrowse/core/ui/SetColorDialog'

import SourcesGrid from './SourcesGrid'

import type { Source } from '../types'

interface ReducedModel {
  sources?: Source[]
  setLayout: (s: Source[]) => void
  clearLayout: () => void
}

export default function SetColorDialog({
  model,
  handleClose,
}: {
  model: ReducedModel
  handleClose: () => void
}) {
  return (
    <SharedSetColorDialog
      model={model}
      handleClose={handleClose}
      title="Multi-sample variant display - Color/arrangement editor"
      enableBulkEdit
      enableRowPalettizer
      showTipsStorageKey="multivariant-showTips"
      SourcesGridComponent={SourcesGrid}
    />
  )
}
