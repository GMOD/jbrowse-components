import { SetColorDialog } from '@jbrowse/tree-sidebar'

import type { ProcessedSource } from '../types.ts'
import type { TreeLayoutModel } from '@jbrowse/tree-sidebar'

// Variants' `editableSources` is the haplotype-expanded, layout-merged,
// non-subtree-filtered view; reordering it persists haplotype rows directly.
// `sampleName`/`HP` are internal plumbing — keep them out of the auto-derived
// extras list and the palettizer choices.
const RESERVED_EXTRA = new Set(['sampleName', 'HP'])

export default function MultiSampleVariantSetColorDialog({
  model,
  handleClose,
}: {
  model: TreeLayoutModel<ProcessedSource>
  handleClose: () => void
}) {
  return (
    <SetColorDialog
      model={model}
      handleClose={handleClose}
      title="Multi-sample variant display - Color/arrangement editor"
      enableBulkEdit
      enableRowPalettizer
      reservedFields={RESERVED_EXTRA}
    />
  )
}
