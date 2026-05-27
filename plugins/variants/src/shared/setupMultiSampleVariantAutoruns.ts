import { setupTreeDrawingAutorun } from '@jbrowse/tree-sidebar'

import { getMultiSampleVariantSourcesAutorun } from './getMultiSampleVariantSourcesAutorun.ts'

type Self = Parameters<typeof getMultiSampleVariantSourcesAutorun>[0] &
  Parameters<typeof setupTreeDrawingAutorun>[0]

export function setupMultiSampleVariantAutoruns(self: Self) {
  getMultiSampleVariantSourcesAutorun(self)
  setupTreeDrawingAutorun(self)
}
