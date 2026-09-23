import { SetColorDialog } from '@jbrowse/tree-sidebar'

import type { MafSource } from '../stateModel.ts'
import type { ColorColumn, TreeLayoutModel } from '@jbrowse/tree-sidebar'

// The one colour a species row has: its label tint, `labelColor`, which the
// adapter's `samples[].color` seeds and `rowColor` overrides. The cells are
// coloured by base, so a row has no `color` of its own.
const ROW_COLOR: ColorColumn<MafSource> = {
  field: 'labelColor',
  headerName: 'Color',
}

/**
 * Reorder, relabel and recolor the species rows.
 *
 * A reorder no rotation of the guide tree produces hides it, and the shared
 * dialog warns when `rowOrderWillDropTree` says so.
 */
export default function SetRowArrangementDialog({
  model,
  handleClose,
}: {
  model: TreeLayoutModel<MafSource>
  handleClose: () => void
}) {
  return (
    <SetColorDialog
      model={model}
      handleClose={handleClose}
      title="MAF display — row arrangement"
      colorColumns={[ROW_COLOR]}
    />
  )
}
