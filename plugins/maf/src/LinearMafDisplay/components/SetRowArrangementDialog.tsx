import { SetColorDialog } from '@jbrowse/tree-sidebar'

import type { MafSource } from '../stateModel.ts'
import type { TreeLayoutModel } from '@jbrowse/tree-sidebar'

/**
 * Reorder, relabel and recolor the species rows.
 *
 * Takes the shared dialog's defaults, including its `color` column. That column
 * used to be reserved out, on the grounds that MAF rows render no per-sample
 * color — true of the alignment *cells*, which are colored by base, but not of
 * the row label, which the sidebar tints from `MafSource.labelColor`. While the
 * tint was being dropped on the way to the sidebar the exclusion was
 * self-consistent; now that it isn't, hiding the column would leave the adapter
 * config able to set something the UI could not.
 *
 * Reordering clears the guide tree — rows would no longer line up with the
 * dendrogram — and the shared dialog warns when `willClearTree` says so.
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
    />
  )
}
