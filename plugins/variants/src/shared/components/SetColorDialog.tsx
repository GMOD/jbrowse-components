import { SetColorDialog } from '@jbrowse/tree-sidebar'

import type { ProcessedSource } from '../types.ts'
import type { ColorColumn, TreeLayoutModel } from '@jbrowse/tree-sidebar'

// The one color a sample row has: its label tint, `labelColor`, which the
// sidebar draws and the group legend reads. The cells are colored by genotype,
// so there is no per-row `color` to edit — a leftover `color` (a samplesTsv
// column, or a session from when the palette was written there) is reserved so
// it doesn't render as a raw hex column.
const ROW_COLOR: ColorColumn<ProcessedSource> = {
  field: 'labelColor',
  headerName: 'Row color',
  bulkLabel: 'Change color of selected rows',
}

// Variants' `editableSources` is the haplotype-expanded, layout-merged,
// non-subtree-filtered view; reordering it persists haplotype rows directly.
// `sampleName`/`HP` are internal plumbing — keep them out of the auto-derived
// extras list and the palettizer choices.
const RESERVED_EXTRA = new Set(['sampleName', 'HP', 'color'])

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
      colorColumns={[ROW_COLOR]}
      enableBulkEdit
      enableRowPalettizer
      reservedFields={RESERVED_EXTRA}
    />
  )
}
