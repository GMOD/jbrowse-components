import { setupTreeDrawingAutorun } from '@jbrowse/tree-sidebar'

import { getMultiSampleVariantClusterAutorun } from './getMultiSampleVariantClusterAutorun.ts'
import { getMultiSampleVariantSourcesAutorun } from './getMultiSampleVariantSourcesAutorun.ts'

type Self = Parameters<typeof getMultiSampleVariantSourcesAutorun>[0] &
  Parameters<typeof setupTreeDrawingAutorun>[0] &
  Parameters<typeof getMultiSampleVariantClusterAutorun>[0]

export function setupMultiSampleVariantAutoruns(self: Self) {
  getMultiSampleVariantSourcesAutorun(self)
  setupTreeDrawingAutorun(self)
  getMultiSampleVariantClusterAutorun(self)
}
