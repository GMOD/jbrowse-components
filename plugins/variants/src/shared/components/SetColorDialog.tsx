import { SetColorDialog } from '@jbrowse/tree-sidebar'

import type { ProcessedSource } from '../types.ts'

// Variants' `editableSources` is the haplotype-expanded, layout-merged,
// non-subtree-filtered view; reordering it persists haplotype rows directly.
// `sampleName`/`HP` are internal plumbing — keep them out of the auto-derived
// extras list and the palettizer choices.
const RESERVED_EXTRA = new Set(['sampleName', 'HP'])

export default function MultiSampleVariantSetColorDialog({
  model,
  handleClose,
}: {
  model: {
    editableSources?: ProcessedSource[]
    clusterTree?: string
    setLayout: (s: ProcessedSource[]) => void
    clearLayout: () => void
  }
  handleClose: () => void
}) {
  return (
    <SetColorDialog
      getSources={() => model.editableSources ?? []}
      onSetLayout={s => {
        model.setLayout(s)
      }}
      onClearLayout={() => {
        model.clearLayout()
      }}
      handleClose={handleClose}
      title="Multi-sample variant display - Color/arrangement editor"
      hasClusterTree={!!model.clusterTree}
      enableBulkEdit
      enableRowPalettizer
      showTipsStorageKey="multivariant-showTips"
      reservedFields={RESERVED_EXTRA}
    />
  )
}
