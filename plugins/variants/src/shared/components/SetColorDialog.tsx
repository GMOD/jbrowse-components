import { SetColorDialog } from '@jbrowse/tree-sidebar'

import type { ProcessedSource } from '../types.ts'

// Variants' `sources` is the haplotype-expanded view; reordering it persists
// haplotype rows directly. `sampleName`/`HP` are internal plumbing — keep
// them out of both the auto-derived extras list and the palettizer.
const RESERVED_EXTRA = new Set(['sampleName', 'HP'])

export default function MultiSampleVariantSetColorDialog({
  model,
  handleClose,
}: {
  model: {
    sources?: ProcessedSource[]
    clusterTree?: string
    setLayout: (s: ProcessedSource[], clearTree?: boolean) => void
    clearLayout: () => void
  }
  handleClose: () => void
}) {
  const dialogModel = {
    get sources() {
      return model.sources ?? []
    },
    setLayout: (s: ProcessedSource[], clearTree?: boolean) => {
      model.setLayout(s, clearTree)
    },
    clearLayout: () => {
      model.clearLayout()
    },
  }
  return (
    <SetColorDialog
      model={dialogModel}
      handleClose={handleClose}
      title="Multi-sample variant display - Color/arrangement editor"
      hasClusterTree={!!model.clusterTree}
      enableBulkEdit
      enableRowPalettizer
      showTipsStorageKey="multivariant-showTips"
      reservedExtra={RESERVED_EXTRA}
      palettizerExcludedFields={RESERVED_EXTRA}
    />
  )
}
