import { SetColorDialog } from '@jbrowse/tree-sidebar'

import type { RowSource, TreeLayoutModel } from '@jbrowse/tree-sidebar'

export default function MarkRowArrangementDialog({
  model,
  handleClose,
}: {
  model: TreeLayoutModel<RowSource>
  handleClose: () => void
}) {
  return (
    <SetColorDialog
      model={model}
      handleClose={handleClose}
      title="Mark display — row arrangement"
    />
  )
}
