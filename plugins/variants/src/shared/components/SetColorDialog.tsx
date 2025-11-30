import SourcesGrid from './SourcesGrid'
import SharedSetColorDialog from './BaseSetColorDialog'

import type { Source } from '../types'

interface ReducedModel {
  sources?: Source[]
  clusterTree?: string
  setLayout: (s: Source[], clearTree?: boolean) => void
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
      model={model as any}
      handleClose={handleClose}
      title="Multi-sample variant display - Color/arrangement editor"
      enableBulkEdit
      enableRowPalettizer
      showTipsStorageKey="multivariant-showTips"
      SourcesGridComponent={SourcesGrid as any}
    />
  )
}
