import { SetColorDialog } from '@jbrowse/tree-sidebar'

import type { ProcessedSource } from '../types.ts'
import type { TreeLayoutModel } from '@jbrowse/tree-sidebar'

// Variants' `editableSources` is the arranged, unfocused view, haplotype
// rows in phased mode. `sampleName`/`HP` are internal plumbing — keep them out
// of the auto-derived extras list.
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
      reservedFields={RESERVED_EXTRA}
    />
  )
}
