import SharedSetColorDialog from '@jbrowse/core/ui/SetColorDialog'

import SourcesGrid from './SourcesGrid'

import type { Source } from '../../util'

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
      model={model as any}
      handleClose={handleClose}
      title="Multi-wiggle color/arrangement editor"
      enableBulkEdit
      enableRowPalettizer
      showTipsStorageKey="multiwiggle-showTips"
      SourcesGridComponent={SourcesGrid as any}
    />
  )
}
